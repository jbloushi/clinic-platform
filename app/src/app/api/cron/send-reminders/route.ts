import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { getDataProvider } from '@/lib/data';
import { notifyAppointmentReminder } from '@/lib/notify';
import { isWhatsAppConfigured } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

/** How far ahead a visit must be to earn today's reminder. */
const LEAD_HOURS = 24;
/** Width of the window scanned, so an hourly run neither skips nor repeats. */
const WINDOW_HOURS = 1;

/**
 * Send day-before reminders for upcoming visits.
 *
 * Designed to run hourly. Each run covers a one-hour slice of appointments
 * starting ~24h out, so a visit falls into exactly one slice and is reminded
 * once — no dedupe table needed, provided the schedule doesn't drift.
 *
 * An AuditLog row is still written per reminder, both for support ("did we tell
 * them?") and so a double-run can be spotted after the fact.
 */
export async function POST(req: NextRequest) {
  if (!env.CRON_SECRET) {
    return NextResponse.json({ error: 'cron_not_configured' }, { status: 503 });
  }
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isWhatsAppConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'whatsapp_not_configured' });
  }

  const from = new Date(Date.now() + LEAD_HOURS * 3600_000);
  const to = new Date(from.getTime() + WINDOW_HOURS * 3600_000);

  const due = await prisma.bookingHold.findMany({
    where: {
      status: { in: ['confirmed', 'pending_payment'] },
      startAt: { gte: from, lt: to },
    },
    take: 200,
  });
  if (due.length === 0) return NextResponse.json({ ok: true, reminded: 0 });

  const dp = getDataProvider();
  const identityIds = due.map((b) => b.patientIdentityId).filter((v): v is string => Boolean(v));
  const identities = await prisma.patientIdentity.findMany({ where: { id: { in: identityIds } } });
  const byIdentity = new Map(identities.map((i) => [i.id, i]));

  let reminded = 0;
  for (const booking of due) {
    const identity = booking.patientIdentityId ? byIdentity.get(booking.patientIdentityId) : undefined;
    // Walk-ins booked straight into OpenEMR have no platform identity, so there
    // is no number to reach — reception handles those.
    if (!identity?.mobile) continue;

    const doctor = await dp.getPractitionerById(booking.practitionerOpenemrId).catch(() => null);
    notifyAppointmentReminder({
      mobile: identity.mobile,
      patientName: [identity.firstName, identity.lastName].filter(Boolean).join(' ') || 'there',
      doctorName: doctor
        ? `${doctor.title} ${doctor.firstName} ${doctor.lastName}`.trim()
        : 'your specialist',
      when: `${booking.startAt.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })} at ${booking.startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
      branchName: 'the clinic',
    });
    reminded += 1;

    await prisma.auditLog
      .create({
        data: {
          actor: 'system',
          action: 'booking.reminder_sent',
          target: booking.id,
          metadata: JSON.stringify({ startAt: booking.startAt.toISOString() }),
        },
      })
      .catch(() => undefined);
  }

  return NextResponse.json({ ok: true, reminded });
}
