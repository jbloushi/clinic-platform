import { describe, expect, it } from 'vitest';
import { resolveChargeAmountMinor } from './amount';
import { finalizeRequestSchema } from './finalize-request';

describe('resolveChargeAmountMinor', () => {
  it('uses only the hold snapshot, ignoring any other amount-shaped field on the object', () => {
    const hold = {
      servicePriceSnapshot: 2500,
      // A forged/mismerged field, as if a caller spread a client body onto the hold.
      amountMinor: 1,
    };
    expect(resolveChargeAmountMinor(hold)).toBe(2500);
  });

  it('falls back to 0 when the hold was created before pricing was snapshotted', () => {
    expect(resolveChargeAmountMinor({ servicePriceSnapshot: null })).toBe(0);
  });
});

describe('finalizeRequestSchema', () => {
  it('strips a forged amountMinor out of the parsed request body entirely', () => {
    const parsed = finalizeRequestSchema.parse({ paymentMethod: 'card', amountMinor: 1 });
    expect(parsed).toEqual({ paymentMethod: 'card' });
    expect('amountMinor' in parsed).toBe(false);
  });

  it('rejects a request with no valid payment method', () => {
    const result = finalizeRequestSchema.safeParse({ amountMinor: 2500 });
    expect(result.success).toBe(false);
  });
});
