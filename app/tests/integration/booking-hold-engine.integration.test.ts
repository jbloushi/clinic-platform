import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { createAutoAssignedBookingHold } from '@/lib/data/booking-hold-engine';

/**
 * Integration coverage for the parts unit tests can't reach: real Prisma
 * transactions racing against MySQL's actual unique constraints, not a mocked
 * client. Requires the local MySQL the rest of the app already targets
 * (ADAPTER_DATABASE_URL) — run via `npm run test:integration`, not `npm test`.
 *
 * Fixtures are created and torn down here rather than depending on
 * `seed-offerings.ts` having run, so this test is self-contained on any
 * checkout that has migrated the schema.
 */

const SPECIALIST_UUID = 'test-integration-practitioner-1';
let branchId: string;
let departmentId: string;
let serviceId: string;

async function resetSettings() {
  // Small quantum so the concurrency test only needs a short slot.
  await prisma.assignmentSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', slotQuantumMinutes: 5, holdDurationMinutes: 15 },
    update: { slotQuantumMinutes: 5, holdDurationMinutes: 15 },
  });
}

beforeAll(async () => {
  const branch = await prisma.branch.create({
    data: {
      slug: `test-integration-branch-${Date.now()}`,
      openemrFacilityId: 900000 + Math.floor(Math.random() * 90000),
      nameEn: 'Integration Test Branch',
      nameAr: 'Integration Test Branch',
      areaEn: 'Test',
      areaAr: 'Test',
      published: true,
    },
  });
  branchId = branch.id;

  const department = await prisma.department.create({
    data: {
      slug: `test-integration-department-${Date.now()}`,
      nameEn: 'Integration Test Department',
      nameAr: 'Integration Test Department',
      summaryEn: 'Test',
      summaryAr: 'Test',
      published: true,
    },
  });
  departmentId = department.id;

  const service = await prisma.service.create({
    data: {
      name: 'Integration Test Service',
      slug: `test-integration-service-${Date.now()}`,
      durationMinutes: 20,
      priceMinor: 1000,
      active: true,
    },
  });
  serviceId = service.id;

  await prisma.serviceBranch.create({
    data: { serviceId, branchId, active: true, publishedOnWeb: true },
  });
  await prisma.serviceDepartment.create({
    data: { serviceId, departmentId, isPrimary: true, active: true },
  });
  await prisma.practitionerBranch.create({
    data: { specialistOpenemrUuid: SPECIALIST_UUID, branchId, active: true },
  });
  await prisma.practitionerOffering.create({
    data: {
      specialistOpenemrUuid: SPECIALIST_UUID,
      serviceId,
      departmentId,
      branchId,
      active: true,
      publishedOnWeb: true,
      allowAutoAssignment: true,
      allowPatientChoice: true,
    },
  });

  await resetSettings();
});

afterAll(async () => {
  // Children first — nothing here cascades onto rows outside this fixture set.
  await prisma.bookingChange.deleteMany({ where: { booking: { branchId } } });
  await prisma.practitionerSlotLock.deleteMany({ where: { hold: { branchId } } });
  await prisma.bookingHold.deleteMany({ where: { branchId } });
  await prisma.practitionerOffering.deleteMany({ where: { branchId } });
  await prisma.practitionerBranch.deleteMany({ where: { specialistOpenemrUuid: SPECIALIST_UUID } });
  await prisma.serviceDepartment.deleteMany({ where: { serviceId } });
  await prisma.serviceBranch.deleteMany({ where: { serviceId } });
  await prisma.service.delete({ where: { id: serviceId } });
  await prisma.department.delete({ where: { id: departmentId } });
  await prisma.branch.delete({ where: { id: branchId } });
});

describe('createAutoAssignedBookingHold concurrency', () => {
  it('lets exactly one of two concurrent requests for the same slot win', async () => {
    const startAt = new Date('2030-01-07T09:00:00.000Z'); // a Monday, far enough out to never collide with other tests
    const endAt = new Date('2030-01-07T09:20:00.000Z');

    const input = {
      serviceId,
      branchId,
      startAt,
      endAt,
      bookingEntryPath: 'SERVICE_PATH' as const,
    };

    const [first, second] = await Promise.all([
      createAutoAssignedBookingHold(input),
      createAutoAssignedBookingHold(input),
    ]);

    const results = [first, second];
    const wins = results.filter((r) => r.ok);
    const losses = results.filter((r) => !r.ok);

    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    expect(losses[0]).toMatchObject({ ok: false, reason: 'no_availability' });

    const winningHold = wins[0]!.ok ? wins[0].hold : null;
    expect(winningHold).not.toBeNull();
    expect(winningHold!.practitionerOpenemrId).toBe(SPECIALIST_UUID);
    expect(winningHold!.assignmentMode).toBe('AUTO');

    const locks = await prisma.practitionerSlotLock.findMany({ where: { holdId: winningHold!.id } });
    expect(locks.length).toBeGreaterThan(0);

    const changes = await prisma.bookingChange.findMany({ where: { bookingId: winningHold!.id } });
    expect(changes.some((c) => c.type === 'AUTO_ASSIGNED')).toBe(true);
  });

  it('reports no_availability once the pool is exhausted (no fallback candidate)', async () => {
    const startAt = new Date('2030-01-08T09:00:00.000Z');
    const endAt = new Date('2030-01-08T09:20:00.000Z');
    const input = {
      serviceId,
      branchId,
      startAt,
      endAt,
      bookingEntryPath: 'SERVICE_PATH' as const,
    };

    const already = await createAutoAssignedBookingHold(input);
    expect(already.ok).toBe(true);

    const again = await createAutoAssignedBookingHold(input);
    expect(again).toMatchObject({ ok: false, reason: 'no_availability' });
  });
});
