import { prisma } from '@/lib/db';
import type { PaymentProvider, PaymentSession, PaymentSessionInput } from './provider';

/**
 * `PAYMENTS_PROVIDER=mock` (default). No real redirect exists to wait on, so
 * `card` resolves synchronously as succeeded; `cash` stays `pending` until
 * staff marks it paid (see /ops/billing), matching the existing pay-at-clinic
 * flow the old `/api/bookings` route used.
 */
export class MockPaymentProvider implements PaymentProvider {
  async createSession(input: PaymentSessionInput): Promise<PaymentSession> {
    const status = input.method === 'cash' ? 'pending' : 'succeeded';
    const payment = await prisma.payment.create({
      data: {
        bookingHoldId: input.bookingHoldId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        method: input.method === 'cash' ? 'cash' : 'card_mock',
        status,
      },
    });
    return { paymentId: payment.id, status };
  }

  async verifySession(paymentId: string): Promise<PaymentSession> {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new Error('payment_not_found');
    return { paymentId: payment.id, status: payment.status as PaymentSession['status'] };
  }

  async handleWebhook(): Promise<null> {
    // Nothing to receive — the mock resolves at createSession time.
    return null;
  }
}
