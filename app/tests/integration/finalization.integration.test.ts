import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { mockProvider } from '@/lib/data/mock/provider';
import { finalizeBooking, retryFinalization } from '@/lib/data/finalization';

/**
 * Finalization idempotency against a real Prisma/MySQL-backed hold — a failed
 * post-payment EMR call must leave the hold in `finalization_failed` (never
 * deleted), and retrying it after the EMR recovers must not charge again or
 * create a second appointment. `mockProvider` is a plain module-level
 * singleton (see `src/lib/data/index.ts`), so its `createAppointment` method
 * is monkey-patched directly rather than mocking the whole module.
 */

let patientIdentityId: string;
let holdId: string;
const originalCreateAppointment = mockProvider.createAppointment;

beforeAll(async () => {
  const identity = await prisma.patientIdentity.create({
    data: { mobile: `test-fin-${Date.now()}`, firstName: 'Test', lastName: 'Finalization' },
  });
  patientIdentityId = identity.id;

  const hold = await prisma.bookingHold.create({
    data: {
      patientIdentityId,
      practitionerOpenemrId: 'mock-practitioner-1',
      serviceId: (await ensureTestService()).id,
      startAt: new Date('2030-02-01T09:00:00.000Z'),
      endAt: new Date('2030-02-01T09:20:00.000Z'),
      status: 'pending_payment',
      holdExpiresAt: new Date('2030-02-01T09:15:00.000Z'),
      servicePriceSnapshot: 1000,
      serviceDurationSnapshot: 20,
    },
  });
  holdId = hold.id;

  await prisma.payment.create({
    data: {
      bookingHoldId: holdId,
      patientId: patientIdentityId,
      amountMinor: 1000,
      currency: 'KWD',
      method: 'card_mock',
      status: 'succeeded',
    },
  });
});

async function ensureTestService() {
  const slug = 'test-finalization-service';
  const existing = await prisma.service.findUnique({ where: { slug } });
  if (existing) return existing;
  return prisma.service.create({
    data: { name: 'Test Finalization Service', slug, durationMinutes: 20, priceMinor: 1000, active: true },
  });
}

afterEach(() => {
  mockProvider.createAppointment = originalCreateAppointment;
});

afterAll(async () => {
  await prisma.bookingChange.deleteMany({ where: { bookingId: holdId } });
  await prisma.payment.deleteMany({ where: { bookingHoldId: holdId } });
  await prisma.bookingHold.delete({ where: { id: holdId } });
  await prisma.patientIdentity.delete({ where: { id: patientIdentityId } });
  await prisma.service.deleteMany({ where: { slug: 'test-finalization-service' } });
});

describe('finalizeBooking / retryFinalization', () => {
  it('lands the hold in finalization_failed (not deleted) when the EMR call fails, then confirms cleanly on retry', async () => {
    let calls = 0;
    mockProvider.createAppointment = async () => {
      calls += 1;
      throw new Error('simulated EMR outage');
    };

    const failed = await finalizeBooking(holdId);
    expect(failed).toMatchObject({ ok: false, reason: 'finalization_failed' });
    expect(calls).toBe(1);

    const afterFailure = await prisma.bookingHold.findUniqueOrThrow({ where: { id: holdId } });
    expect(afterFailure.status).toBe('finalization_failed');
    expect(afterFailure.openemrAppointmentId).toBeNull();

    const paymentsAfterFailure = await prisma.payment.count({ where: { bookingHoldId: holdId } });
    expect(paymentsAfterFailure).toBe(1); // no duplicate charge from the failed attempt

    // EMR recovers.
    mockProvider.createAppointment = originalCreateAppointment;
    const retried = await retryFinalization(holdId);
    expect(retried.ok).toBe(true);
    if (!retried.ok) throw new Error('unreachable');
    expect(retried.hold.status).toBe('confirmed');
    expect(retried.hold.openemrAppointmentId).toBeTruthy();

    const paymentsAfterRetry = await prisma.payment.count({ where: { bookingHoldId: holdId } });
    expect(paymentsAfterRetry).toBe(1); // still exactly one — retry didn't charge again

    // A further call is a pure no-op: same appointment id, no second EMR call.
    let secondCallCount = 0;
    mockProvider.createAppointment = async (...args) => {
      secondCallCount += 1;
      return originalCreateAppointment(...args);
    };
    const again = await retryFinalization(holdId);
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.hold.openemrAppointmentId).toBe(retried.hold.openemrAppointmentId);
    expect(secondCallCount).toBe(0);
  });
});
