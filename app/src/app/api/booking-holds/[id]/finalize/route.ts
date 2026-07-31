import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { getPaymentProvider } from '@/lib/payments';
import { resolveChargeAmountMinor } from '@/lib/payments/amount';
import { finalizeRequestSchema as bodySchema } from '@/lib/payments/finalize-request';
import { finalizeBooking } from '@/lib/data/finalization';

/**
 * Pays for and finalizes a hold. Amount is always read from
 * `BookingHold.servicePriceSnapshot` — a client-supplied amount is never
 * trusted, since that snapshot is the only value that was actually shown to
 * the patient before they agreed to pay.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.patient) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const { id } = await params;
  const hold = await prisma.bookingHold.findUnique({ where: { id } });
  if (!hold || hold.patientIdentityId !== session.patient.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (hold.status === 'confirmed') {
    return NextResponse.json({ ok: true, status: 'confirmed', openemrAppointmentId: hold.openemrAppointmentId });
  }
  if (hold.status !== 'held' && hold.status !== 'pending_payment' && hold.status !== 'finalization_failed') {
    return NextResponse.json({ error: 'hold_not_active', status: hold.status }, { status: 409 });
  }
  if (hold.holdExpiresAt < new Date() && hold.status !== 'finalization_failed') {
    return NextResponse.json({ error: 'hold_expired' }, { status: 409 });
  }

  // Only create a new payment session if this hold hasn't already got one —
  // a retry after a finalization failure must not charge (or re-mark cash
  // pending) twice.
  const existingPayment = await prisma.payment.findFirst({
    where: { bookingHoldId: hold.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!existingPayment) {
    const provider = getPaymentProvider();
    const session_ = await provider.createSession({
      bookingHoldId: hold.id,
      amountMinor: resolveChargeAmountMinor(hold),
      currency: 'KWD',
      method: parsed.data.paymentMethod,
    });
    await prisma.bookingHold.update({ where: { id: hold.id }, data: { status: 'pending_payment' } });
    await prisma.bookingChange.create({
      data: {
        bookingId: hold.id,
        type: session_.status === 'succeeded' ? 'PAYMENT_SUCCEEDED' : 'PAYMENT_STARTED',
        newData: { method: parsed.data.paymentMethod, status: session_.status },
      },
    });
  }

  const result = await finalizeBooking(hold.id);
  if (!result.ok) {
    const status = result.reason === 'payment_pending' ? 402 : result.reason === 'hold_not_found' ? 404 : 409;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json({
    ok: true,
    status: result.hold.status,
    openemrAppointmentId: result.hold.openemrAppointmentId,
  });
}
