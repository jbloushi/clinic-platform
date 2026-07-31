import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { getDataProvider } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** Statuses that still occupy a slot without the visit being settled. */
const PROVISIONAL = ['held', 'pending_payment'];

/**
 * Release booking holds whose window has passed.
 *
 * Without this, an abandoned checkout keeps its slot forever: the hold's
 * `activeSlotKey` stays in the unique index and no one else can take the time.
 * Expiring the row clears the key and frees it.
 *
 * Only provisional holds are touched. A confirmed booking is a real
 * appointment and is never expired here, regardless of age — those end via
 * cancellation or by being marked completed/no-show at the clinic.
 *
 * Auth is a shared secret so a scheduler can call it without a session. When
 * CRON_SECRET is unset the route refuses rather than running open.
 */
export async function POST(req: NextRequest) {
  if (!env.CRON_SECRET) {
    return NextResponse.json({ error: 'cron_not_configured' }, { status: 503 });
  }
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const stale = await prisma.bookingHold.findMany({
    where: {
      status: { in: PROVISIONAL },
      holdExpiresAt: { lt: now },
      activeSlotKey: { not: null },
    },
    select: { id: true, openemrAppointmentId: true },
    take: 500,
  });

  if (stale.length === 0) return NextResponse.json({ ok: true, expired: 0 });

  const dp = getDataProvider();
  let expired = 0;

  for (const hold of stale) {
    try {
      // Slot-lock rows don't cascade-delete on a status update (only on hold
      // deletion) — without this an expired hold keeps blocking its buckets.
      await prisma.$transaction([
        prisma.practitionerSlotLock.deleteMany({ where: { holdId: hold.id } }),
        prisma.bookingHold.update({
          where: { id: hold.id },
          data: { status: 'expired', activeSlotKey: null },
        }),
      ]);
      expired += 1;

      // A hold that got as far as writing to OpenEMR leaves an appointment
      // behind; cancel it so the EMR calendar matches what we just released.
      if (hold.openemrAppointmentId) {
        await dp.updateAppointmentStatus(hold.openemrAppointmentId, 'cancelled').catch(() => {});
      }
      await prisma.auditLog
        .create({
          data: {
            actor: 'system',
            action: 'booking.expired',
            target: hold.id,
            metadata: JSON.stringify({ openemrAppointmentId: hold.openemrAppointmentId }),
          },
        })
        .catch(() => undefined);
    } catch {
      // One bad row shouldn't strand the rest of the batch; the next run retries it.
    }
  }

  return NextResponse.json({ ok: true, expired });
}
