'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Identity step: OTP verifies who the patient is, then `PATCH
 * /api/booking-holds/[id]` attaches that identity to the already-reserved
 * hold. The hold exists (and its slot is locked) before this runs — identity
 * is layered on afterwards, not a precondition for reserving the time.
 */
export function DetailsForm({ holdId, branchSlug }: { holdId: string; branchSlug?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<'details' | 'code'>('details');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  async function verifyAndContinue(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const verifyRes = await fetch('/api/auth/patient/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, code, firstName, lastName }),
      });
      if (!verifyRes.ok) {
        setError('That code is wrong or has expired. Request a new one and try again.');
        return;
      }

      const patchRes = await fetch(`/api/booking-holds/${holdId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      if (!patchRes.ok) {
        const data = await patchRes.json().catch(() => ({}));
        setError(
          data.error === 'hold_expired'
            ? 'Your reserved slot expired. Please pick a time again.'
            : 'We could not continue with this reservation. Please try again.',
        );
        return;
      }

      const query = new URLSearchParams({ holdId });
      if (branchSlug) query.set('branch', branchSlug);
      router.push(`/book/v2/review?${query}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      {step === 'details' && (
        <form onSubmit={requestOtp} className="flex flex-1 flex-col">
          <div className="space-y-4">
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
              hint="We'll text a one-time code to confirm — no password needed."
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
              Your slot is already reserved. Verifying your number confirms who it&apos;s for.
            </p>

            <ErrorMessage message={error} />
          </div>

          <div className="sticky-action-bar -mx-5 mt-6 flex gap-2.5 px-5 pt-3.5 md:-mx-8 md:px-8">
            <SubmitButton loading={loading} loadingLabel="Sending code…">
              Continue
            </SubmitButton>
          </div>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={verifyAndContinue} className="flex flex-1 flex-col">
          <div className="space-y-4">
            <p className="text-[13.5px] leading-relaxed text-muted-foreground">
              We sent a 6-digit code to <span className="font-semibold text-foreground">+965 {mobile}</span>.
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

          <div className="sticky-action-bar -mx-5 mt-6 flex gap-2.5 px-5 pt-3.5 md:-mx-8 md:px-8">
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
              Verify &amp; continue
            </SubmitButton>
          </div>
        </form>
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
      <label htmlFor={htmlFor} className="mb-1.5 block text-[12px] font-semibold text-foreground/80">
        {label}
        {optional && <span className="ms-1 font-normal text-placeholder">(optional)</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[11.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SubmitButton({ loading, loadingLabel, children }: { loading: boolean; loadingLabel: string; children: React.ReactNode }) {
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
