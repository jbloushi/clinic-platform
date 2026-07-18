'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, CheckCircle2, CreditCard, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Stepper } from '@/components/domain/stepper';
import { formatCurrency } from '@/lib/utils';

type ServiceOpt = { id: string; name: string; durationMinutes: number; priceMinor: number };

const STEPS = [
  { key: 'details', label: 'Your details' },
  { key: 'code', label: 'Verify' },
  { key: 'pay', label: 'Confirm & pay' },
];

export function BookingForm({
  practitionerId,
  start,
  end,
  consultationFeeMinor,
  currency,
  services,
}: {
  // Omitted when booking via /book/service — the specialist is auto-assigned
  // server-side from the service's eligible pool at commit time.
  practitionerId?: string;
  start: string;
  end: string;
  consultationFeeMinor: number;
  currency: string;
  services: ServiceOpt[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<'details' | 'code' | 'pay'>('details');
  const currentIndex = step === 'details' ? 0 : step === 'code' ? 1 : 2;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('card');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const service = services.find((s) => s.id === serviceId);
  const feeMinor = service?.priceMinor ?? consultationFeeMinor;

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/patient/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      });
      if (!res.ok) {
        setError('Could not send verification code.');
        return;
      }
      setStep('code');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/patient/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, code, firstName, lastName }),
      });
      if (!res.ok) {
        setError('Wrong or expired code.');
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not confirm booking.');
        return;
      }
      router.push(`/book/confirmed?id=${data.bookingId}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Stepper steps={STEPS} current={currentIndex} />

      {step === 'details' && (
        <form onSubmit={requestOtp} className="space-y-4">
          <Card>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <Label>Service</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {services.map((s) => {
                    const active = s.id === serviceId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setServiceId(s.id)}
                        className={`flex items-center justify-between rounded-md border p-3 text-left transition-all press-scale ${
                          active
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                            : 'hover:border-primary/40'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {s.durationMinutes} min
                          </p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums">
                          {formatCurrency(s.priceMinor, currency)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fn">First name</Label>
                  <Input
                    id="fn"
                    required
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ln">Last name</Label>
                  <Input
                    id="ln"
                    required
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="m">Mobile number</Label>
                <Input
                  id="m"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+1 555 123 4567"
                />
                <p className="text-xs text-muted-foreground">
                  We&apos;ll text a one-time code to verify it&apos;s you.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="r">Reason for visit (optional)</Label>
                <Input id="r" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              {error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Sending code…' : 'Continue'}
          </Button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={verifyOtp} className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <p className="text-sm text-muted-foreground">
                We sent a 6-digit code to{' '}
                <span className="font-medium text-foreground">{mobile}</span>.
              </p>
              <div className="space-y-2">
                <Label htmlFor="code" className="sr-only">
                  Verification code
                </Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="\d{6}"
                  required
                  className="h-14 text-center text-2xl tracking-[0.5em] tabular-nums"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  aria-label="6-digit verification code"
                />
                <p className="text-center text-xs text-muted-foreground">
                  Demo code is{' '}
                  <code className="rounded bg-muted px-1 py-0.5 tabular-nums">123456</code>.
                </p>
              </div>
              {error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep('details')} disabled={loading}>
              Back
            </Button>
            <Button type="submit" size="lg" className="flex-1" disabled={loading}>
              {loading ? 'Verifying…' : 'Verify'}
            </Button>
          </div>
        </form>
      )}

      {step === 'pay' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center justify-between gap-3 border-b pb-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Service</p>
                  <p className="font-medium">{service?.name ?? 'Consultation'}</p>
                </div>
                <p className="text-lg font-semibold tabular-nums">{formatCurrency(feeMinor, currency)}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-xl font-semibold tabular-nums">{formatCurrency(feeMinor, currency)}</span>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-2">
            <Label>Payment</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                aria-pressed={paymentMethod === 'card'}
                className={`flex items-center gap-3 rounded-md border p-3 text-left transition-all press-scale ${
                  paymentMethod === 'card' ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'hover:border-primary/40'
                }`}
              >
                <CreditCard className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="block text-sm font-medium">Pay online</span>
                  <span className="block text-xs text-muted-foreground">Card (demo)</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                aria-pressed={paymentMethod === 'cash'}
                className={`flex items-center gap-3 rounded-md border p-3 text-left transition-all press-scale ${
                  paymentMethod === 'cash' ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'hover:border-primary/40'
                }`}
              >
                <Banknote className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="block text-sm font-medium">Pay at clinic</span>
                  <span className="block text-xs text-muted-foreground">Cash on arrival</span>
                </span>
              </button>
            </div>
          </div>
          <Card className="border-dashed">
            <CardContent className="flex items-center gap-3 pt-6 text-sm text-muted-foreground">
              {paymentMethod === 'card' ? (
                <>
                  <CreditCard className="h-4 w-4" aria-hidden />
                  Mock payment for the demo. In production this is a secure card checkout.
                  <ShieldCheck className="ml-auto h-4 w-4 text-emerald-600" aria-hidden />
                </>
              ) : (
                <>
                  <Banknote className="h-4 w-4" aria-hidden />
                  Pay {formatCurrency(feeMinor, currency)} in cash when you arrive. Your slot is reserved now.
                  <ShieldCheck className="ml-auto h-4 w-4 text-emerald-600" aria-hidden />
                </>
              )}
            </CardContent>
          </Card>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <Button onClick={pay} size="lg" className="w-full" disabled={loading}>
            {loading ? (
              'Confirming…'
            ) : paymentMethod === 'card' ? (
              <>
                <Lock className="mr-1 h-4 w-4" />
                Pay {formatCurrency(feeMinor, currency)} &amp; confirm
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-1 h-4 w-4" />
                Reserve &amp; pay at clinic
              </>
            )}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
            You&apos;ll get an instant confirmation
          </p>
        </div>
      )}
    </div>
  );
}
