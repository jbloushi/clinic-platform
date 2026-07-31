import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { rescheduleBookingHold } from '@/lib/data/reschedule';

/**
 * Branch/doctor/service-changing reschedule against real Prisma/MySQL —
 * proves the create-new-before-cancel-old ordering (a failed reschedule
 * leaves the original booking untouched), payment carryover when the price
 * doesn't change, and the no-op guard for a same-doctor/same-instant request.
 */

// Real mock-provider practitioner ids (see src/lib/data/mock/provider.ts) —
// `createPractitionerSelectedBookingHold` resolves the doctor through the
// EMR provider for its active-in-EMR check, so a synthetic id that isn't in
// the mock roster fails validation before ever reaching the reschedule logic
// under test. -3/-4 are unused by the seed-offerings.ts fixtures.
const SPECIALIST_A = 'mock-practitioner-3';
const SPECIALIST_B = 'mock-practitioner-4';
let branchId: string;
let departmentId: string;
let serviceId: string;
let patientIdentityId: string;

beforeAll(async () => {
  const branch = await prisma.branch.create({
    data: {
      slug: `test-reschedule-branch-${Date.now()}`,
      openemrFacilityId: 910000 + Math.floor(Math.random() * 9000),
      nameEn: 'Reschedule Test Branch',
      nameAr: 'Reschedule Test Branch',
      areaEn: 'Test',
      areaAr: 'Test',
      published: true,
    },
  });
  branchId = branch.id;

  const department = await prisma.department.create({
    data: {
      slug: `test-reschedule-department-${Date.now()}`,
      nameEn: 'Reschedule Test Department',
      nameAr: 'Reschedule Test Department',
      summaryEn: 'Test',
      summaryAr: 'Test',
      published: true,
    },
  });
  departmentId = department.id;

  const service = await prisma.service.create({
    data: {
      name: 'Reschedule Test Service',
      slug: `test-reschedule-service-${Date.now()}`,
      durationMinutes: 20,
      priceMinor: 1500,
      active: true,
    },
  });
  serviceId = service.id;

  await prisma.serviceBranch.create({ data: { serviceId, branchId, active: true, publishedOnWeb: true } });
  await prisma.serviceDepartment.create({ data: { serviceId, departmentId, isPrimary: true, active: true } });

  for (const uuid of [SPECIALIST_A, SPECIALIST_B]) {
    await prisma.practitionerBranch.create({ data: { specialistOpenemrUuid: uuid, branchId, active: true } });
    await prisma.practitionerOffering.create({
      data: {
        specialistOpenemrUuid: uuid,
        serviceId,
        departmentId,
        branchId,
        active: true,
        publishedOnWeb: true,
        allowAutoAssignment: true,
        allowPatientChoice: true,
      },
    });
  }

  const identity = await prisma.patientIdentity.create({
    data: { mobile: `test-reschedule-${Date.now()}`, firstName: 'Test', lastName: 'Reschedule' },
  });
  patientIdentityId = identity.id;

  await prisma.assignmentSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', slotQuantumMinutes: 5, holdDurationMinutes: 15 },
    update: { slotQuantumMinutes: 5, holdDurationMinutes: 15 },
  });
});

afterAll(async () => {
  const holdIds = (await prisma.bookingHold.findMany({ where: { branchId }, select: { id: true } })).map((h) => h.id);
  await prisma.bookingChange.deleteMany({ where: { bookingId: { in: holdIds } } });
  await prisma.payment.deleteMany({ where: { bookingHoldId: { in: holdIds } } });
  await prisma.practitionerSlotLock.deleteMany({ where: { hold: { branchId } } });
  await prisma.bookingHold.deleteMany({ where: { branchId } });
  await prisma.practitionerOffering.deleteMany({ where: { branchId } });
  await prisma.practitionerBranch.deleteMany({ where: { specialistOpenemrUuid: { in: [SPECIALIST_A, SPECIALIST_B] } } });
  await prisma.serviceDepartment.deleteMany({ where: { serviceId } });
  await prisma.serviceBranch.deleteMany({ where: { serviceId } });
  await prisma.service.delete({ where: { id: serviceId } });
  await prisma.department.delete({ where: { id: departmentId } });
  await prisma.branch.delete({ where: { id: branchId } });
  await prisma.patientIdentity.delete({ where: { id: patientIdentityId } });
});

async function createConfirmedPaidHold(
  startAt: Date,
  endAt: Date,
  payment: { method: string; status: string } = { method: 'card_mock', status: 'succeeded' },
) {
  const hold = await prisma.bookingHold.create({
    data: {
      patientIdentityId,
      practitionerOpenemrId: SPECIALIST_A,
      serviceId,
      branchId,
      startAt,
      endAt,
      status: 'confirmed',
      holdExpiresAt: new Date(startAt.getTime() - 60_000),
      servicePriceSnapshot: 1500,
      serviceDurationSnapshot: 20,
      openemrAppointmentId: `mock-appointment-preexisting-${startAt.getTime()}`,
    },
  });
  await prisma.payment.create({
    data: {
      bookingHoldId: hold.id,
      patientId: patientIdentityId,
      amountMinor: 1500,
      currency: 'KWD',
      method: payment.method,
      status: payment.status,
    },
  });
  return hold;
}

describe('rescheduleBookingHold', () => {
  it('changes doctor, carries the existing payment forward, and auto-confirms when the price is unchanged', async () => {
    const original = await createConfirmedPaidHold(
      new Date('2031-03-03T09:00:00.000Z'),
      new Date('2031-03-03T09:20:00.000Z'),
    );

    const result = await rescheduleBookingHold({
      currentHoldId: original.id,
      specialistOpenemrUuid: SPECIALIST_B,
      departmentId,
      startAt: new Date('2031-03-04T10:00:00.000Z'),
      endAt: new Date('2031-03-04T10:20:00.000Z'),
      actor: `patient:${patientIdentityId}`,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.paymentRequired).toBe(false);
    expect(result.hold.status).toBe('confirmed');
    expect(result.hold.practitionerOpenemrId).toBe(SPECIALIST_B);
    expect(result.hold.openemrAppointmentId).toBeTruthy();

    const oldHold = await prisma.bookingHold.findUniqueOrThrow({ where: { id: original.id } });
    expect(oldHold.status).toBe('cancelled');
    expect(oldHold.activeSlotKey).toBeNull();

    const oldLocks = await prisma.practitionerSlotLock.count({ where: { holdId: original.id } });
    expect(oldLocks).toBe(0);

    // Exactly one payment, now pointing at the new hold — not a second charge.
    const payments = await prisma.payment.findMany({ where: { bookingHoldId: { in: [original.id, result.hold.id] } } });
    expect(payments).toHaveLength(1);
    expect(payments[0].bookingHoldId).toBe(result.hold.id);

    const oldChanges = await prisma.bookingChange.findMany({ where: { bookingId: original.id } });
    expect(oldChanges.some((c) => c.type === 'PRACTITIONER_CHANGED')).toBe(true);
    expect(oldChanges.some((c) => c.type === 'RESCHEDULED')).toBe(true);
  });

  it('leaves the original hold completely untouched when the replacement cannot be created', async () => {
    const original = await createConfirmedPaidHold(
      new Date('2031-03-05T09:00:00.000Z'),
      new Date('2031-03-05T09:20:00.000Z'),
    );

    // No offering exists for this service/branch combination with a bogus
    // department, so creating the replacement fails before the original is touched.
    const result = await rescheduleBookingHold({
      currentHoldId: original.id,
      specialistOpenemrUuid: 'nonexistent-practitioner',
      departmentId,
      startAt: new Date('2031-03-06T09:00:00.000Z'),
      endAt: new Date('2031-03-06T09:20:00.000Z'),
      actor: `patient:${patientIdentityId}`,
    });

    expect(result.ok).toBe(false);

    const stillThere = await prisma.bookingHold.findUniqueOrThrow({ where: { id: original.id } });
    expect(stillThere.status).toBe('confirmed');
    expect(stillThere.practitionerOpenemrId).toBe(SPECIALIST_A);
  });

  it('carries a still-pending cash payment forward and confirms without asking to pay again', async () => {
    // Cash bookings confirm immediately (paid at reception) with the Payment
    // row left at status:'pending' — this regressed once already: the
    // carryover logic looked only for status:'succeeded' and silently fell
    // back to an unfinalized hold while still claiming paymentRequired:false.
    const original = await createConfirmedPaidHold(
      new Date('2031-03-09T09:00:00.000Z'),
      new Date('2031-03-09T09:20:00.000Z'),
      { method: 'cash', status: 'pending' },
    );

    const result = await rescheduleBookingHold({
      currentHoldId: original.id,
      startAt: new Date('2031-03-10T09:00:00.000Z'),
      endAt: new Date('2031-03-10T09:20:00.000Z'),
      actor: `patient:${patientIdentityId}`,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.paymentRequired).toBe(false);
    expect(result.hold.status).toBe('confirmed');
    expect(result.hold.openemrAppointmentId).toBeTruthy();

    const payments = await prisma.payment.findMany({ where: { bookingHoldId: { in: [original.id, result.hold.id] } } });
    expect(payments).toHaveLength(1);
    expect(payments[0].bookingHoldId).toBe(result.hold.id);
    expect(payments[0].status).toBe('pending'); // still owed at reception — reschedule doesn't fabricate a charge succeeding
  });

  it('reports no_op for a same-doctor request at the exact same instant', async () => {
    const original = await createConfirmedPaidHold(
      new Date('2031-03-07T09:00:00.000Z'),
      new Date('2031-03-07T09:20:00.000Z'),
    );

    const result = await rescheduleBookingHold({
      currentHoldId: original.id,
      startAt: original.startAt,
      endAt: original.endAt,
      actor: `patient:${patientIdentityId}`,
    });

    expect(result).toMatchObject({ ok: false, reason: 'no_op' });

    const unchanged = await prisma.bookingHold.findUniqueOrThrow({ where: { id: original.id } });
    expect(unchanged.status).toBe('confirmed');
  });
});
