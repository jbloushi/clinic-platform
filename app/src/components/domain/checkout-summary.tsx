import { Wallet } from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';

export type CheckoutLine = {
  label: string;
  amountMinor: number;
  /** `credit` renders in teal with a minus sign — wallet or discount rows. */
  tone?: 'default' | 'credit';
};

/**
 * Checkout summary from the approved design: itemised lines, then the total in
 * editorial type. Wallet credit is a `credit` line *and* an explicit balance
 * panel, so it's clear both that credit exists and that it was applied.
 *
 * All amounts are passed in already computed — pricing decisions belong to the
 * server, never to this component.
 */
export function CheckoutSummary({
  lines,
  totalMinor,
  currency = 'KWD',
  walletBalanceMinor,
  walletAppliedMinor,
  className,
}: {
  lines: CheckoutLine[];
  totalMinor: number;
  currency?: string;
  /** Omit when the patient has no wallet — the panel then doesn't render. */
  walletBalanceMinor?: number;
  walletAppliedMinor?: number;
  className?: string;
}) {
  const showWallet = walletBalanceMinor !== undefined && walletBalanceMinor > 0;

  return (
    <div className={cn('space-y-5', className)}>
      <section>
        <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Summary
        </h2>
        <dl className="rounded-card border bg-surface p-4">
          {lines.map((line, index) => (
            <div
              key={index}
              className={cn(
                'flex items-baseline justify-between gap-3 text-[13.5px]',
                index > 0 && 'mt-2.5',
                line.tone === 'credit' && 'text-primary',
              )}
            >
              <dt className={line.tone === 'credit' ? undefined : 'text-foreground/75'}>
                {line.label}
              </dt>
              <dd className="shrink-0 font-semibold tabular-nums">
                {line.tone === 'credit' ? '− ' : ''}
                {formatPrice(Math.abs(line.amountMinor), currency)}
              </dd>
            </div>
          ))}
          <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-muted pt-3">
            <dt className="font-editorial text-[16px] font-semibold">Total</dt>
            <dd className="font-editorial text-[20px] font-bold tabular-nums">
              {formatPrice(totalMinor, currency)}
            </dd>
          </div>
        </dl>
      </section>

      {showWallet && (
        <div className="brand-gradient flex items-center justify-between gap-3 rounded-card p-4 text-surface-soft">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[12px] opacity-75">
              <Wallet className="h-3.5 w-3.5" aria-hidden />
              Clinic wallet
            </p>
            <p className="mt-0.5 font-editorial text-[20px] font-bold tabular-nums">
              {formatPrice(walletBalanceMinor, currency)}
            </p>
          </div>
          {walletAppliedMinor !== undefined && walletAppliedMinor > 0 && (
            <span className="shrink-0 rounded-full border border-white/30 bg-white/[.15] px-3.5 py-2 text-[12.5px] font-semibold">
              {formatPrice(walletAppliedMinor, currency)} applied
            </span>
          )}
        </div>
      )}
    </div>
  );
}
