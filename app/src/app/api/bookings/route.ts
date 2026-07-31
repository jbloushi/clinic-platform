import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { getDataProvider } from '@/lib/data';
import { normalizeMobile } from '@/lib/auth/mobile';
import { getBookableService, getEligibleServicesForSpecialist, getServiceSpecialistIds } from '@/lib/data/service-catalog';
import { ensureEmrPatientId, slotKey } from '@/lib/data/patient-link';
import { getBranchBySlug, restrictToBranch } from '@/lib/data/reference-repo';
import { notifyBookingConfirmed } from '@/lib/notify';

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
  // 'card' = mock online payment (marked paid). 'cash' = pay at clinic (COD) —
  // slot is reserved now, payment recorded as pending.
  paymentMethod: z.enum(['card', 'cash']).default('card'),
  // Set when this visit continues an earlier one, so the chart can show them as
  // one case. Validated below against the caller's own bookings — an id from
  // someone else's history would otherwise leak that it exists.
  followUpFromBookingId: z.string().min(1).optional(),
  // Display-only: names the location in the confirmation message. The visit
  // itself is located by the practitioner's facility in OpenEMR.
  branch: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.patient) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const mobile = normalizeMobile(parsed.data.mobile);
  const service = await getBookableService(parsed.data.serviceId);
  if (!service) return NextResponse.json({ error: 'invalid_service' }, { status: 400 });

  // The branch is where the visit happens, so it has to resolve to a real,
  // published location before anything is written.
  const bookingBranch = parsed.data.branch ? await getBranchBySlug(parsed.data.branch) : null;
  if (parsed.data.branch && (!bookingBranch || !bookingBranch.published)) {
    return NextResponse.json({ error: 'invalid_branch' }, { status: 400 });
  }

  const dp = getDataProvider();
  const identity = await prisma.patientIdentity.findUnique({ where: { mobile } });
  if (!identity) return NextResponse.json({ error: 'identity_missing' }, { status: 401 });

  // Ensure a live EMR record backs this identity, registering one if the stored
  // mapping has gone stale. See ensureEmrPatientId for why it can.
  let openemrUuid: string;
  try {
    const resolved = await ensureEmrPatientId(identity.id, {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
    });
    if (!resolved) return NextResponse.json({ error: 'patient_create_failed' }, { status: 502 });
    openemrUuid = resolved;
  } catch (e: any) {
    return NextResponse.json({ error: `patient_create_failed: ${e?.message ?? e}` }, { status: 502 });
  }

  if (session.patient.openemrPatientUuid !== openemrUuid) {
    session.patient = {
      ...session.patient,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      openemrPatientUuid: openemrUuid,
    };
    await session.save();
  }

  // Resolve candidate specialists. Explicit pick from /doctors/[id] is a
  // single-item list — a P2002 hit there just means someone else took that
  // exact slot. Auto-assign from /book/service gets the full ordered
  // eligible pool: OpenEMR appointments still block obviously-busy
  // candidates (e.g. one booked directly through the ops calendar, which
  // never touches BookingHold), and if our top pick loses the atomic gate
  // below to a concurrent request, we fall through to the next one instead
  // of 409ing while other specialists are still free.
  // Doctor-first: reject a serviceId the chosen specialist isn't eligible for
  // (defense in depth — the UI already filters the list, but a stale/crafted
  // request shouldn't book a doctor for a service they can't perform).
  if (parsed.data.practitionerId) {
    const eligibleServices = await getEligibleServicesForSpecialist(parsed.data.practitionerId);
    if (!eligibleServices.some((eligibleService) => eligibleService.id === service.id)) {
      return NextResponse.json({ error: 'service_not_eligible' }, { status: 400 });
    }
  }

  // A follow-up must continue a visit this same patient actually had. Checking
  // ownership rather than mere existence keeps an arbitrary id from confirming
  // that someone else's booking exists.
  let followUpFromId: string | undefined;
  if (parsed.data.followUpFromBookingId) {
    const original = await prisma.bookingHold.findFirst({
      where: { id: parsed.data.followUpFromBookingId, patientIdentityId: identity.id },
      select: { id: true },
    });
    if (!original) return NextResponse.json({ error: 'invalid_follow_up' }, { status: 400 });
    followUpFromId = original.id;
  }

  const configuredUuids = await getServiceSpecialistIds(service.id);
  const roster = await dp.getPractitioners({ activeOnly: true });
  const configuredEligible =
    configuredUuids.length > 0
      ? roster.filter((practitioner) => configuredUuids.includes(practitioner.id))
      : roster;
  // The same restriction the pickers applied, re-checked at commit: a stale or
  // crafted request must not book a doctor who doesn't work at this branch.
  const eligibleUuids = (await restrictToBranch(configuredEligible, bookingBranch?.id)).map(
    (practitioner) => practitioner.id,
  );
  if (parsed.data.practitionerId && !eligibleUuids.includes(parsed.data.practitionerId)) {
    return NextResponse.json({ error: 'practitioner_not_at_branch' }, { status: 400 });
  }
  const candidatePool = parsed.data.practitionerId ? [parsed.data.practitionerId] : eligibleUuids;
  const targetDate = parsed.data.start.slice(0, 10);
  const availability = await Promise.all(
    candidatePool.map(async (candidate) => ({
      candidate,
      slots: await dp.getAvailableSlots(candidate, targetDate, targetDate, service.durationMinutes, {
        branchId: bookingBranch?.id,
      }),
    })),
  );
  const candidates = availability
    .filter(({ slots }) => slots.some((slot) => slot.available && slot.start === parsed.data.start && slot.end === parsed.data.end))
    .map(({ candidate }) => candidate);
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
          activeSlotKey: slotKey(candidate, parsed.data.start),
          reason: parsed.data.reason,
          holdExpiresAt: new Date(parsed.data.start),
          followUpFromBookingId: followUpFromId,
          branchId: bookingBranch?.id,
          // Snapshot the facility actually used, so the record of where this
          // visit happened survives the branch later being re-pointed.
          openemrFacilityId: bookingBranch?.openemrFacilityId ?? null,
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
      facilityId: bookingBranch?.openemrFacilityId ?? undefined,
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

  // Pay-at-clinic (COD) records a pending cash payment; online mock pay marks it succeeded.
  const isCash = parsed.data.paymentMethod === 'cash';
  await prisma.payment.create({
    data: {
      bookingHoldId: booking.id,
      patientId: identity.id,
      amountMinor: service.priceMinor,
      currency: service.currency,
      method: isCash ? 'cash' : 'card_mock',
      status: isCash ? 'pending' : 'succeeded',
    },
  });

  await prisma.auditLog.create({
    data: {
      actor: `patient:${identity.id}`,
      action: 'booking.confirmed',
      target: booking.id,
      metadata: JSON.stringify({
        openemrAppointmentId,
        practitionerId,
        paymentMethod: parsed.data.paymentMethod,
        followUpFromBookingId: followUpFromId,
      }),
    },
  });

  // Fire-and-forget: the appointment exists regardless of whether the
  // confirmation message lands, and the patient is about to see the
  // confirmation screen either way.
  const doctor = await dp.getPractitionerById(practitionerId).catch(() => null);
  notifyBookingConfirmed({
    mobile,
    patientName: `${parsed.data.firstName} ${parsed.data.lastName}`.trim(),
    doctorName: doctor
      ? `${doctor.title} ${doctor.firstName} ${doctor.lastName}`.trim()
      : 'your specialist',
    when: formatVisitTime(parsed.data.start),
    branchName: bookingBranch?.nameEn ?? 'the clinic',
  });

  return NextResponse.json({ ok: true, bookingId: booking.id });
}

/** Human-readable visit time for a notification body. */
function formatVisitTime(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })} at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}
