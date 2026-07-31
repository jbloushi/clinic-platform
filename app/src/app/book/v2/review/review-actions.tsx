'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, Check, CreditCard, Lock } from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';

type PaymentMethod = 'card' | 'cash';

export function ReviewActions({
  holdId,
  feeMinor,
  retry,
}: {
  holdId: string;
  feeMinor: number;
  /** A previous finalization attempt failed after payment — retrying must not charge again. */
  retry: boolean;
}) {
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/booking-holds/${holdId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === 'hold_expired'
            ? 'Your reserved slot expired. Please start again.'
            : data.error === 'finalization_failed'
              ? 'Payment succeeded, but we could not confirm the appointment. Please try again — you will not be charged twice.'
              : 'We could not complete this booking. Please try again.',
        );
        return;
      }
      router.push(`/book/confirmed?id=${holdId}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      {retry && (
        <p className="mb-4 rounded-control border border-tint-gold-border bg-tint-gold p-3.5 text-[12.5px] leading-relaxed text-accent-foreground">
          Your appointment could not be confirmed last time. Try again below — any payment already made will not be
          repeated.
        </p>
      )}

      <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Pay with</h2>
      <div className="space-y-2.5" role="radiogroup" aria-label="Payment method">
        <PaymentOption
          selected={paymentMethod === 'card'}
          onSelect={() => setPaymentMethod('card')}
          icon={<CreditCard className="h-[18px] w-[18px]" aria-hidden />}
          label="Card payment"
          hint="Secure online checkout"
        />
        <PaymentOption
          selected={paymentMethod === 'cash'}
          onSelect={() => setPaymentMethod('cash')}
          icon={<Banknote className="h-[18px] w-[18px]" aria-hidden />}
          label="Pay at the clinic"
          hint={`Bring ${formatPrice(feeMinor, 'KWD')} to reception`}
        />
      </div>

      <p className="mt-4 flex gap-2 rounded-control bg-muted p-3 text-[11.5px] leading-relaxed text-muted-foreground">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        {paymentMethod === 'card'
          ? 'Your appointment is confirmed once payment succeeds.'
          : 'Your slot is reserved now and payment is taken at reception when you arrive.'}
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-control border border-[#EBCFCB] bg-[#F7E5E3] px-3 py-2.5 text-[12.5px] text-[#8A2E24]">
          {error}
        </p>
      )}

      <div className="sticky-action-bar -mx-5 mt-6 flex gap-2.5 px-5 pt-3.5 md:-mx-8 md:px-8">
        <button
          type="button"
          onClick={pay}
          disabled={loading}
          className="press-scale flex min-h-[48px] flex-1 items-center justify-center rounded-[13px] bg-primary px-5 text-[15px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? 'Confirming…' : paymentMethod === 'card' ? `Pay ${formatPrice(feeMinor, 'KWD')}` : 'Reserve appointment'}
        </button>
      </div>
    </div>
  );
}

function PaymentOption({
  selected,
  onSelect,
  icon,
  label,
  hint,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'press-scale flex w-full items-center gap-3 rounded-[13px] border bg-surface p-3.5 text-start',
        selected ? 'border-[1.5px] border-primary' : 'hover:bg-muted',
      )}
    >
      <span
        className={cn(
          'flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md',
          selected ? 'bg-tint-teal text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{label}</span>
        <span className="block text-[11.5px] text-muted-foreground">{hint}</span>
      </span>
      {selected && (
        <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}
