import { env } from '@/lib/env';
import type { PaymentProvider } from './provider';
import { MockPaymentProvider } from './mock-provider';

export type { PaymentProvider, PaymentMethod, PaymentSession, PaymentSessionInput, PaymentStatus } from './provider';

let cached: PaymentProvider | null = null;

/** Swapping in a real gateway later only means adding a case here. */
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  switch (env.PAYMENTS_PROVIDER) {
    case 'mock':
      cached = new MockPaymentProvider();
      return cached;
    case 'stripe':
    case 'tap':
    case 'hyperpay':
      throw new Error(`PAYMENTS_PROVIDER="${env.PAYMENTS_PROVIDER}" has no implementation yet.`);
  }
}
