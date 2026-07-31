/**
 * Gateway-agnostic payment interface. A real gateway (Stripe/Tap/HyperPay)
 * only ever touches this directory — nothing outside `src/lib/payments/`
 * should import a specific provider.
 */

export type PaymentMethod = 'card' | 'cash';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export type PaymentSessionInput = {
  bookingHoldId: string;
  /** Always computed server-side from the booking's snapshot — never client input. */
  amountMinor: number;
  currency: string;
  method: PaymentMethod;
};

export type PaymentSession = {
  paymentId: string;
  status: PaymentStatus;
  /** Where to send the patient to complete payment. Absent when nothing to redirect to. */
  redirectUrl?: string;
};

export interface PaymentProvider {
  createSession(input: PaymentSessionInput): Promise<PaymentSession>;
  verifySession(paymentId: string): Promise<PaymentSession>;
  /** Returns null when the payload isn't a webhook this provider recognizes. */
  handleWebhook(payload: unknown, headers: Headers): Promise<{ paymentId: string; status: PaymentStatus } | null>;
}
