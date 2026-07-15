import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { getDataProvider } from '@/lib/data';
import { normalizeMobile } from '@/lib/auth/mobile';
import { getEligibleSpecialistUuids, rankSpecialistsForSlot } from '@/lib/data/openemr/provider';

const bodySchema = z.object({
  // Omitted from /book/service — the specialist is auto-assigned server-side
  // from the service's eligible pool. Present when booked from /doctors/[id].
  practitionerId: z.string().min(1).optional(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  reason: z.string().optional(),
  serviceId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  mobile: z.string().min(6),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.patient) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const mobile = normalizeMobile(parsed.data.mobile);
  const service = await prisma.service.findUnique({ where: { id: parsed.data.serviceId } });
  if (!service) return NextResponse.json({ error: 'invalid_service' }, { status: 400 });

  const dp = getDataProvider();
  let identity = await prisma.patientIdentity.findUnique({ where: { mobile } });
  if (!identity) return NextResponse.json({ error: 'identity_missing' }, { status: 401 });

  // Ensure a patient exists in OpenEMR and remember the mapping.
  let openemrUuid = identity.openemrPatientUuid;
  if (!openemrUuid) {
    try {
      const created = await dp.createPatient({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        mobile,
        sex: 'unknown',
      });
      openemrUuid = created.id;
      identity = await prisma.patientIdentity.update({
        where: { id: identity.id },
        data: { openemrPatientUuid: openemrUuid, firstName: parsed.data.firstName, lastName: parsed.data.lastName },
      });
      session.patient = { ...session.patient, firstName: parsed.data.firstName, lastName: parsed.data.lastName, openemrPatientUuid: openemrUuid };
      await session.save();
    } catch (e: any) {
      return NextResponse.json({ error: `patient_create_failed: ${e?.message ?? e}` }, { status: 502 });
    }
  }

  // Resolve candidate specialists. Explicit pick from /doctors/[id] is a
  // single-item list — a P2002 hit there just means someone else took that
  // exact slot. Auto-assign from /book/service gets the full ordered
  // eligible pool: OpenEMR appointments still block obviously-busy
  // candidates (e.g. one booked directly through the ops calendar, which
  // never touches BookingHold), and if our top pick loses the atomic gate
  // below to a concurrent request, we fall through to the next one instead
  // of 409ing while other specialists are still free.
  const candidates = parsed.data.practitionerId
    ? [parsed.data.practitionerId]
    : await rankSpecialistsForSlot(await getEligibleSpecialistUuids(service.id), parsed.data.start, parsed.data.end);
  if (candidates.length === 0) {
    return NextResponse.json({ error: 'slot_conflict' }, { status: 409 });
  }

  // Atomic serialization gate: OpenEMR's appointment table has no unique
  // constraint preventing two concurrent bookings for the same
  // practitioner/time (confirmed empirically), so BookingHold's
  // (practitionerOpenemrId, startAt) unique constraint is what actually
  // prevents the race. Try candidates in order until one wins the insert.
  let practitionerId: string | undefined;
  let booking: Awaited<ReturnType<typeof prisma.bookingHold.create>> | undefined;
  for (const candidate of candidates) {
    try {
      booking = await prisma.bookingHold.create({
        data: {
          patientIdentityId: identity.id,
          practitionerOpenemrId: candidate,
          serviceId: service.id,
          startAt: new Date(parsed.data.start),
          endAt: new Date(parsed.data.end),
          status: 'confirmed',
          reason: parsed.data.reason,
          holdExpiresAt: new Date(parsed.data.start),
        },
      });
      practitionerId = candidate;
      break;
    } catch (e: any) {
      if (e?.code === 'P2002') continue; // candidate just got taken — try the next one
      throw e;
    }
  }
  if (!practitionerId || !booking) {
    return NextResponse.json({ error: 'slot_conflict' }, { status: 409 });
  }

  // Create appointment in OpenEMR. On failure, roll back the hold — it never
  // represented a real appointment.
  let openemrAppointmentId: string | undefined;
  try {
    const appt = await dp.createAppointment({
      patientId: openemrUuid!,
      practitionerId,
      start: parsed.data.start,
      end: parsed.data.end,
      reason: parsed.data.reason,
      status: 'confirmed',
    });
    openemrAppointmentId = appt.id;
  } catch (e: any) {
    await prisma.bookingHold.delete({ where: { id: booking.id } }).catch(() => {});
    return NextResponse.json({ error: `appointment_create_failed: ${e?.message ?? e}` }, { status: 502 });
  }

  booking = await prisma.bookingHold.update({ where: { id: booking.id }, data: { openemrAppointmentId } });

  await prisma.payment.create({
    data: {
      bookingHoldId: booking.id,
      patientId: identity.id,
      amountMinor: service.priceMinor,
      currency: service.currency,
      method: 'card_mock',
      status: 'succeeded',
    },
  });

  await prisma.auditLog.create({
    data: {
      actor: `patient:${identity.id}`,
      action: 'booking.confirmed',
      target: booking.id,
      metadata: JSON.stringify({ openemrAppointmentId, practitionerId }),
    },
  });

  return NextResponse.json({ ok: true, bookingId: booking.id });
}
