import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { getDataProvider } from '@/lib/data';
import { getBookableService } from '@/lib/data/service-catalog';
import { ensureEmrPatientId, slotKey } from '@/lib/data/patient-link';

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('cancel') }),
  z.object({
    action: z.literal('reschedule'),
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
]);

/** Statuses a booking can still be moved or called off from. */
const CHANGEABLE = new Set(['held', 'pending_payment', 'confirmed']);

/**
 * Cancel or reschedule a booking.
 *
 * Both actions release the original slot by nulling `activeSlotKey` rather than
 * deleting the row: the visit still happened as a decision, and billing and
 * audit both need it. A released key stops competing in the unique index, so
 * the freed time becomes bookable again.
 *
 * Reschedule is deliberately cancel-then-create rather than an in-place move —
 * the new time has to win the same concurrency gate as any other booking, and
 * an UPDATE would sidestep it.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const staff = session.staff;
  const patient = session.patient;
  if (!staff && !patient) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const booking = await prisma.bookingHold.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Reception and admin act on anyone's booking; a patient only on their own.
  // Same 404 either way — "exists but isn't yours" is not something to confirm.
  const staffMayChange = staff ? ['reception', 'admin', 'doctor'].includes(staff.role) : false;
  const isOwner = patient ? booking.patientIdentityId === patient.id : false;
  if (!staffMayChange && !isOwner) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (!CHANGEABLE.has(booking.status)) {
    return NextResponse.json({ error: 'not_changeable', status: booking.status }, { status: 409 });
  }
  // A visit already in progress or past is reception's to settle in person.
  if (booking.startAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: 'already_started' }, { status: 409 });
  }

  const actor = staff ? `staff:${staff.id}` : `patient:${patient!.id}`;
  const dp = getDataProvider();

  if (parsed.data.action === 'cancel') {
    await releaseBooking(booking.id, 'cancelled');

    if (booking.openemrAppointmentId) {
      // Best effort: the slot is already released on our side, and a stale
      // "confirmed" in OpenEMR is safer than leaving our own state ambiguous.
      await dp.updateAppointmentStatus(booking.openemrAppointmentId, 'cancelled').catch(() => {});
    }
    await prisma.payment
      .updateMany({ where: { bookingHoldId: booking.id, status: 'pending' }, data: { status: 'failed' } })
      .catch(() => {});
    await audit(actor, 'booking.cancelled', booking.id, {
      openemrAppointmentId: booking.openemrAppointmentId,
    });

    return NextResponse.json({ ok: true, status: 'cancelled' });
  }

  // ---- reschedule ----
  const { start, end } = parsed.data;
  if (new Date(start).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'start_in_past' }, { status: 400 });
  }

  const service = await getBookableService(booking.serviceId);
  const practitionerId = booking.practitionerOpenemrId;

  // The new time must be genuinely open for the same specialist — a reschedule
  // keeps the doctor, so there's no candidate pool to fall back through.
  const day = start.slice(0, 10);
  const slots = await dp
    .getAvailableSlots(practitionerId, day, day, service?.durationMinutes, {
      branchId: booking.branchId ?? undefined,
    })
    .catch(() => []);
  const openForSlot = slots.some((slot) => slot.available && slot.start === start && slot.end === end);
  if (!openForSlot) return NextResponse.json({ error: 'slot_conflict' }, { status: 409 });

  // Release first so moving within the same doctor's calendar can't deadlock
  // against its own old key, then claim the new one under the unique index.
  await releaseBooking(booking.id, 'cancelled');

  let replacement;
  try {
    replacement = await prisma.bookingHold.create({
      data: {
        patientIdentityId: booking.patientIdentityId,
        practitionerOpenemrId: practitionerId,
        serviceId: booking.serviceId,
        startAt: new Date(start),
        endAt: new Date(end),
        status: 'confirmed',
        activeSlotKey: slotKey(practitionerId, start),
        reason: booking.reason,
        holdExpiresAt: new Date(start),
        followUpFromBookingId: booking.followUpFromBookingId,
        rescheduledFromBookingId: booking.id,
        // A reschedule moves the time, not the location. Carrying these forward
        // is what stops the replacement being written against the env default
        // facility — i.e. silently relocating the patient to another clinic.
        branchId: booking.branchId,
        openemrFacilityId: booking.openemrFacilityId,
      },
    });
  } catch (e: any) {
    // Lost the race. Put the patient back where they were rather than leaving
    // them with no appointment at all.
    await prisma.bookingHold
      .update({
        where: { id: booking.id },
        data: { status: booking.status, activeSlotKey: slotKey(practitionerId, booking.startAt) },
      })
      .catch(() => {});
    if (e?.code === 'P2002') return NextResponse.json({ error: 'slot_conflict' }, { status: 409 });
    throw e;
  }

  // Move the OpenEMR appointment across: cancel the old event, create the new.
  let openemrAppointmentId: string | undefined;
  try {
    if (booking.openemrAppointmentId) {
      await dp.updateAppointmentStatus(booking.openemrAppointmentId, 'cancelled').catch(() => {});
    }
    const patientUuid = booking.patientIdentityId
      ? await ensureEmrPatientId(booking.patientIdentityId)
      : null;
    if (!patientUuid) throw new Error('patient_record_unavailable');
    const created = await dp.createAppointment({
      patientId: patientUuid,
      practitionerId,
      facilityId: booking.openemrFacilityId ?? undefined,
      start,
      end,
      reason: booking.reason ?? undefined,
      status: 'confirmed',
    });
    openemrAppointmentId = created.id;
    replacement = await prisma.bookingHold.update({
      where: { id: replacement.id },
      data: { openemrAppointmentId },
    });
  } catch (e: any) {
    // The EMR write failed, so this booking doesn't represent a real
    // appointment — undo it rather than leaving a slot held for nothing.
    await releaseBooking(replacement.id, 'cancelled').catch(() => {});
    await prisma.bookingHold
      .update({
        where: { id: booking.id },
        data: { status: booking.status, activeSlotKey: slotKey(practitionerId, booking.startAt) },
      })
      .catch(() => {});
    return NextResponse.json(
      { error: `reschedule_failed: ${e?.message ?? e}` },
      { status: 502 },
    );
  }

  // Carry the payment across so a paid visit stays paid at its new time.
  await prisma.payment
    .updateMany({ where: { bookingHoldId: booking.id }, data: { bookingHoldId: replacement.id } })
    .catch(() => {});

  await audit(actor, 'booking.rescheduled', replacement.id, {
    from: booking.id,
    previousStart: booking.startAt.toISOString(),
    start,
    openemrAppointmentId,
  });

  return NextResponse.json({ ok: true, bookingId: replacement.id });
}

/** Mark a booking finished and free its slot for someone else. */
async function releaseBooking(id: string, status: 'cancelled' | 'expired') {
  return prisma.bookingHold.update({
    where: { id },
    data: { status, activeSlotKey: null },
  });
}

async function audit(actor: string, action: string, target: string, metadata: unknown) {
  await prisma.auditLog
    .create({ data: { actor, action, target, metadata: JSON.stringify(metadata) } })
    .catch(() => undefined);
}
