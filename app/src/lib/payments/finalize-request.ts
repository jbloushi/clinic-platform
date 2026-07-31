import { z } from 'zod';

/**
 * What a client may ask for when finalizing a hold: a payment method, nothing
 * else. There is deliberately no `amountMinor` field — `z.object()` strips
 * unrecognized keys by default, so a forged one is silently dropped during
 * parsing rather than merely unused by convention. The real amount always
 * comes from `resolveChargeAmountMinor` (amount.ts) reading the hold's own
 * snapshot, never from this body.
 */
export const finalizeRequestSchema = z.object({ paymentMethod: z.enum(['card', 'cash']) });
