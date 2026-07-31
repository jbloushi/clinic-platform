/**
 * The one place a charge amount is computed. Deliberately takes only the
 * fields it needs from a hold, not the hold plus a request body — there is no
 * parameter here for a client-supplied amount to occupy, so nothing upstream
 * can pass one through by accident. `servicePriceSnapshot` is what the
 * patient actually saw and agreed to pay at review time; a live re-price
 * would let a since-changed service price silently retarget an already-shown
 * total.
 */
export function resolveChargeAmountMinor(hold: { servicePriceSnapshot: number | null }): number {
  return hold.servicePriceSnapshot ?? 0;
}
