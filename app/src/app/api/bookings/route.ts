import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { getDataProvider } from '@/lib/data';
import { normalizeMobile } from '@/lib/auth/mobile';

const bodySchema = z.object({
  practitionerId: z.string().min(1),
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

  // Race check
  const day = parsed.data.start.slice(0, 10);
  const existing = await dp.getAppointments({ practitionerId: parsed.data.practitionerId, from: day, to: day }).catch(() => []);
  const conflict = existing.some(
    (a) =>
      a.status !== 'cancelled' &&
      new Date(a.start).getTime() < new Date(parsed.data.end).getTime() &&
      new Date(a.end).getTime() > new Date(parsed.data.start).getTime(),
  );
  if (conflict) return NextResponse.json({ error: 'slot_conflict' }, { status: 409 });

  // Create appointment in OpenEMR
  let openemrAppointmentId: string | undefined;
  try {
    const appt = await dp.createAppointment({
      patientId: openemrUuid!,
      practitionerId: parsed.data.practitionerId,
      start: parsed.data.start,
      end: parsed.data.end,
      reason: parsed.data.reason,
      status: 'confirmed',
    });
    openemrAppointmentId = appt.id;
  } catch (e: any) {
    return NextResponse.json({ error: `appointment_create_failed: ${e?.message ?? e}` }, { status: 502 });
  }

  // Record locally: booking hold (confirmed) + mock payment
  const booking = await prisma.bookingHold.create({
    data: {
      patientIdentityId: identity.id,
      practitionerOpenemrId: parsed.data.practitionerId,
      serviceId: service.id,
      startAt: new Date(parsed.data.start),
      endAt: new Date(parsed.data.end),
      status: 'confirmed',
      openemrAppointmentId,
      reason: parsed.data.reason,
      holdExpiresAt: new Date(parsed.data.start),
    },
  });

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
      metadata: JSON.stringify({ openemrAppointmentId, practitionerId: parsed.data.practitionerId }),
    },
  });

  return NextResponse.json({ ok: true, bookingId: booking.id });
}
