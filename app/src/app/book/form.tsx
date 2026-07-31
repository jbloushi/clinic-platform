'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, Check, CreditCard, Lock, ShieldCheck } from 'lucide-react';
import { BookingSummary } from '@/components/domain/booking-summary';
import { CheckoutSummary } from '@/components/domain/checkout-summary';
import { Stepper } from '@/components/domain/stepper';
import { cn, formatPrice } from '@/lib/utils';

type ServiceOpt = { id: string; name: string; durationMinutes: number; priceMinor: number };
type PaymentMethod = 'card' | 'cash';

/**
 * Visible booking steps. The slot is already chosen by the time this form
 * mounts, so it renders as complete — the design's "skip what's already
 * decided" behaviour. Phone verification is a sub-state of Details rather than
 * its own step: it's the same decision (who are you), just confirmed.
 */
const STEPS = [
  { key: 'slot', label: 'Slot' },
  { key: 'details', label: 'Details' },
  { key: 'pay', label: 'Payment' },
];

export function BookingForm({
  practitionerId,
  practitionerName,
  practitionerSpecialty,
  practitionerPhotoUrl,
  start,
  end,
  consultationFeeMinor,
  currency,
  services,
  editHref,
  branchName,
  branchSlug,
  followUpFromBookingId,
}: {
  // Omitted when booking via /book/service — the specialist is auto-assigned
  // server-side from the service's eligible pool at commit time.
  practitionerId?: string;
  /** Set when this visit continues an earlier one; links the two on commit. */
  followUpFromBookingId?: string;
  practitionerName?: string;
  practitionerSpecialty?: string;
  practitionerPhotoUrl?: string | null;
  start: string;
  end: string;
  consultationFeeMinor: number;
  currency: string;
  services: ServiceOpt[];
  editHref?: string;
  branchName?: string;
  branchSlug?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<'details' | 'code' | 'pay'>('details');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const service = services.find((s) => s.id === serviceId);
  const feeMinor = service?.priceMinor ?? consultationFeeMinor;
  const currentStepIndex = step === 'pay' ? 2 : 1;

  async function requestOtp(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/patient/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      });
      if (!res.ok) {
        setError('We could not send the verification code. Check the number and try again.');
        return;
      }
      setCode('');
      setStep('code');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/patient/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, code, firstName, lastName }),
      });
      if (!res.ok) {
        // Deliberately identical whether or not the number is known to us —
        // the response must never reveal that a patient record exists.
        setError('That code is wrong or has expired. Request a new one and try again.');
        return;
      }
      setStep('pay');
    } finally {
      setLoading(false);
    }
  }

  async function pay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practitionerId,
          start,
          end,
          reason: reason || service?.name,
          serviceId,
          firstName,
          lastName,
          mobile,
          paymentMethod,
          followUpFromBookingId,
          branch: branchSlug,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'We could not confirm this booking. Please try again.');
        return;
      }
      router.push(`/book/confirmed?id=${data.bookingId}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <Stepper steps={STEPS} current={currentStepIndex} className="mb-5" />

      <BookingSummary
        doctorName={practitionerName}
        doctorSpecialty={practitionerSpecialty}
        doctorPhotoUrl={practitionerPhotoUrl}
        start={start}
        branchName={branchName}
        serviceName={step === 'details' ? undefined : service?.name}
        editHref={step === 'details' ? editHref : undefined}
        className="mb-5"
      />

      {step === 'details' && (
        <form onSubmit={requestOtp} className="flex flex-1 flex-col">
          <div className="space-y-4">
            {services.length > 1 && (
              <Field label="Reason for visit">
                <select
                  value={serviceId}
                  onChange={(event) => setServiceId(event.target.value)}
                  className="h-[48px] w-full rounded-control border bg-surface px-3 text-[14px]"
                >
                  {services.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} · {option.durationMinutes} min
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" htmlFor="given-name">
                <input
                  id="given-name"
                  required
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="h-[48px] w-full rounded-control border bg-surface px-3 text-[14px]"
                />
              </Field>
              <Field label="Last name" htmlFor="family-name">
                <input
                  id="family-name"
                  required
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="h-[48px] w-full rounded-control border bg-surface px-3 text-[14px]"
                />
              </Field>
            </div>

            <Field
              label="Mobile number"
              htmlFor="mobile"
              hint="We’ll text a one-time code to confirm — no password needed."
            >
              <div className="flex items-center gap-2 rounded-control border border-[1.5px] border-primary bg-surface px-3 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <span className="shrink-0 text-[14px] text-muted-foreground" aria-hidden>
                  +965
                </span>
                <input
                  id="mobile"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  required
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  placeholder="6 000 0000"
                  aria-describedby="mobile-hint"
                  className="h-[48px] min-w-0 flex-1 bg-transparent text-[14px] outline-none"
                />
              </div>
            </Field>

            <Field label="Anything we should know?" htmlFor="reason" optional>
              <textarea
                id="reason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Optional — briefly, what would you like to discuss?"
                className="w-full rounded-control border bg-surface p-3 text-[14px]"
              />
            </Field>

            <p className="flex gap-2 rounded-control bg-muted p-3 text-[11.5px] leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              Your details are used to create or match your clinic record. Clinical information stays
              in the clinic’s medical record system.
            </p>

            <ErrorMessage message={error} />
          </div>

          <StickyBar>
            <SubmitButton loading={loading} loadingLabel="Sending code…">
              Continue
            </SubmitButton>
          </StickyBar>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={verifyOtp} className="flex flex-1 flex-col">
          <div className="space-y-4">
            <p className="text-[13.5px] leading-relaxed text-muted-foreground">
              We sent a 6-digit code to{' '}
              <span className="font-semibold text-foreground">+965 {mobile}</span>.
            </p>
            <Field label="Verification code" htmlFor="otp">
              <input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="\d{6}"
                required
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                className="h-[56px] w-full rounded-control border bg-surface text-center font-editorial text-[24px] tracking-[0.4em] tabular-nums"
              />
            </Field>
            <ErrorMessage message={error} />
          </div>

          <StickyBar>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep('details');
              }}
              disabled={loading}
              className="press-scale flex min-h-[48px] items-center justify-center rounded-[13px] border bg-surface px-5 text-[14px] font-semibold disabled:opacity-60"
            >
              Back
            </button>
            <SubmitButton loading={loading} loadingLabel="Verifying…">
              Verify
            </SubmitButton>
          </StickyBar>
        </form>
      )}

      {step === 'pay' && (
        <div className="flex flex-1 flex-col">
          <CheckoutSummary
            lines={[
              {
                label: service?.name ?? 'Consultation',
                amountMinor: feeMinor,
              },
              { label: 'Booking fee', amountMinor: 0 },
            ]}
            totalMinor={feeMinor}
            currency={currency}
          />

          <h2 className="mb-2.5 mt-5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Pay with
          </h2>
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
              hint={`Bring ${formatPrice(feeMinor, currency)} to reception`}
            />
          </div>

          <p className="mt-4 flex gap-2 rounded-control bg-muted p-3 text-[11.5px] leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            {paymentMethod === 'card'
              ? 'Card payments run through the clinic’s payment provider. Your appointment is confirmed once payment succeeds.'
              : 'Your slot is reserved now and payment is taken at reception when you arrive.'}
          </p>

          <ErrorMessage message={error} className="mt-4" />

          <StickyBar>
            <button
              type="button"
              onClick={pay}
              disabled={loading}
              className="press-scale flex min-h-[48px] flex-1 items-center justify-center rounded-[13px] bg-primary px-5 text-[15px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {loading
                ? 'Confirming…'
                : paymentMethod === 'card'
                  ? `Pay ${formatPrice(feeMinor, currency)}`
                  : 'Reserve appointment'}
            </button>
          </StickyBar>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  optional,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[12px] font-semibold text-foreground/80"
      >
        {label}
        {optional && <span className="ms-1 font-normal text-placeholder">(optional)</span>}
      </label>
      {children}
      {hint && (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="mt-1.5 text-[11.5px] text-muted-foreground">
          {hint}
        </p>
      )}
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
        <span
          aria-hidden
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <Check className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}

function StickyBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky-action-bar -mx-5 mt-6 flex gap-2.5 px-5 pt-3.5 md:-mx-8 md:px-8">
      {children}
    </div>
  );
}

function SubmitButton({
  loading,
  loadingLabel,
  children,
}: {
  loading: boolean;
  loadingLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="press-scale flex min-h-[48px] flex-1 items-center justify-center rounded-[13px] bg-primary px-5 text-[15px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
    >
      {loading ? loadingLabel : children}
    </button>
  );
}

function ErrorMessage({ message, className }: { message: string | null; className?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={cn(
        'rounded-control border border-[#EBCFCB] bg-[#F7E5E3] px-3 py-2.5 text-[12.5px] text-[#8A2E24]',
        className,
      )}
    >
      {message}
    </p>
  );
}
