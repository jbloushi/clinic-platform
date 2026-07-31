import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';

/**
 * Poll a hold's status/expiry — used by the details/review steps.
 *
 * The id is an unguessable cuid, the same access model `/book/confirmed`
 * already uses. Readable without a session while it has no identity attached
 * yet (still mid-checkout, nothing sensitive on it); once a patient is
 * attached (via `PATCH`, right after OTP), only that patient or staff may
 * read it.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await params;
  const hold = await prisma.bookingHold.findUnique({ where: { id } });
  if (!hold) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (hold.patientIdentityId) {
    const owner = session.patient?.id === hold.patientIdentityId;
    if (!owner && !session.staff) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    id: hold.id,
    status: hold.status,
    holdExpiresAt: hold.holdExpiresAt,
    practitionerId: hold.practitionerOpenemrId,
    practitionerName: hold.practitionerNameSnapshot,
    serviceName: hold.serviceNameSnapshot,
    branchName: hold.branchNameSnapshot,
    startAt: hold.startAt,
    endAt: hold.endAt,
    priceMinor: hold.servicePriceSnapshot,
    durationMinutes: hold.serviceDurationSnapshot,
    openemrAppointmentId: hold.openemrAppointmentId,
  });
}

const patchSchema = z.object({ reason: z.string().max(2000).optional() });

/**
 * Attach the now-verified patient to an anonymously-created hold, right after
 * OTP succeeds and before payment. Refuses to move a hold between patients —
 * only a hold with no identity yet, or one already owned by this session, can
 * be (re-)patched.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.patient) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const { id } = await params;
  const hold = await prisma.bookingHold.findUnique({ where: { id } });
  if (!hold) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (hold.patientIdentityId && hold.patientIdentityId !== session.patient.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (hold.status !== 'held' && hold.status !== 'pending_payment') {
    return NextResponse.json({ error: 'hold_not_active', status: hold.status }, { status: 409 });
  }
  if (hold.holdExpiresAt < new Date()) {
    return NextResponse.json({ error: 'hold_expired' }, { status: 409 });
  }

  const updated = await prisma.bookingHold.update({
    where: { id: hold.id },
    data: {
      patientIdentityId: session.patient.id,
      reason: parsed.data.reason ?? hold.reason,
    },
  });

  return NextResponse.json({ ok: true, id: updated.id });
}
