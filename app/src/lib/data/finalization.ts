import type { BookingHold } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getDataProvider } from '@/lib/data';
import { ensureEmrPatientId } from './patient-link';

/**
 * The step that turns a paid (or pay-later) hold into a real OpenEMR
 * appointment. Idempotent by design: it's called once right after payment,
 * and again by `retryFinalization` whenever a previous attempt failed after
 * payment succeeded — a state that must never be resolved by charging twice
 * or silently losing the appointment.
 */

export type FinalizeResult =
  | { ok: true; hold: BookingHold }
  | { ok: false; reason: 'hold_not_found' }
  | { ok: false; reason: 'hold_not_active'; status: string }
  | { ok: false; reason: 'payment_pending' }
  | { ok: false; reason: 'finalization_failed'; message: string };

/**
 * Verifies payment, then calls OpenEMR. Never re-runs the EMR call once a
 * `confirmed` hold already carries an `openemrAppointmentId` — that pairing is
 * the idempotency check, not a status flag alone, so a hold that somehow
 * reached `confirmed` without an appointment id (shouldn't happen, but cheap
 * to guard) still gets one attempt.
 */
export async function finalizeBooking(holdId: string): Promise<FinalizeResult> {
  const hold = await prisma.bookingHold.findUnique({ where: { id: holdId } });
  if (!hold) return { ok: false, reason: 'hold_not_found' };

  if (hold.status === 'confirmed' && hold.openemrAppointmentId) {
    return { ok: true, hold };
  }
  if (hold.status === 'cancelled' || hold.status === 'expired') {
    return { ok: false, reason: 'hold_not_active', status: hold.status };
  }

  // Cash is pay-at-clinic: the appointment is real the moment the slot is
  // reserved, same as the old route. Card must have actually settled.
  const payment = await prisma.payment.findFirst({
    where: { bookingHoldId: holdId },
    orderBy: { createdAt: 'desc' },
  });
  const paymentSatisfied =
    (hold.servicePriceSnapshot ?? 0) === 0 ||
    payment?.status === 'succeeded' ||
    payment?.method === 'cash';
  if (!paymentSatisfied) return { ok: false, reason: 'payment_pending' };

  await prisma.bookingChange.create({
    data: { bookingId: hold.id, type: 'FINALIZATION_STARTED', newData: { status: hold.status } },
  });

  if (!hold.patientIdentityId) {
    return await failFinalization(hold, 'missing_patient_identity');
  }
  const openemrPatientUuid = await ensureEmrPatientId(hold.patientIdentityId).catch(() => null);
  if (!openemrPatientUuid) {
    return await failFinalization(hold, 'patient_registration_failed');
  }

  const dp = getDataProvider();
  try {
    const appt = await dp.createAppointment({
      patientId: openemrPatientUuid,
      practitionerId: hold.practitionerOpenemrId,
      facilityId: hold.openemrFacilityId ?? undefined,
      start: hold.startAt.toISOString(),
      end: hold.endAt.toISOString(),
      reason: hold.reason ?? undefined,
      status: 'confirmed',
    });

    const confirmed = await prisma.bookingHold.update({
      where: { id: hold.id },
      data: { status: 'confirmed', openemrAppointmentId: appt.id },
    });
    await prisma.bookingChange.create({
      data: { bookingId: hold.id, type: 'CONFIRMED', newData: { openemrAppointmentId: appt.id } },
    });
    return { ok: true, hold: confirmed };
  } catch (e: any) {
    return await failFinalization(hold, e?.message ?? String(e));
  }
}

async function failFinalization(hold: BookingHold, message: string): Promise<FinalizeResult> {
  await prisma.bookingHold.update({ where: { id: hold.id }, data: { status: 'finalization_failed' } });
  await prisma.bookingChange.create({
    data: { bookingId: hold.id, type: 'FINALIZATION_FAILED', newData: { message } },
  });
  return { ok: false, reason: 'finalization_failed', message };
}

/** Same function, safe to call again — see the idempotency check above. */
export const retryFinalization = finalizeBooking;
