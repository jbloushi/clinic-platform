'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';

type ServiceOpt = { id: string; name: string; durationMinutes: number; priceMinor: number };

/**
 * Single-page booking stepper: details → OTP → mock pay → confirmed.
 * The moment "verify OTP" succeeds we also register the patient in OpenEMR (if
 * new), then create the appointment. Payment is mocked but recorded.
 */
export function BookingForm({
  practitionerId,
  start,
  end,
  consultationFeeMinor,
  currency,
  services,
}: {
  practitionerId: string;
  start: string;
  end: string;
  consultationFeeMinor: number;
  currency: string;
  services: ServiceOpt[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<'details' | 'code' | 'pay'>('details');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
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

  if (step === 'details') {
    return (
      <form onSubmit={requestOtp} className="space-y-4">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label>Service</Label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {formatCurrency(s.priceMinor, currency)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fn">First name</Label>
                <Input id="fn" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ln">Last name</Label>
                <Input id="ln" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="m">Mobile number</Label>
              <Input id="m" type="tel" required value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+1 555 123 4567" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r">Reason for visit (optional)</Label>
              <Input id="r" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </CardContent>
        </Card>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Sending code…' : 'Continue'}
        </Button>
      </form>
    );
  }

  if (step === 'code') {
    return (
      <form onSubmit={verifyOtp} className="space-y-4">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm text-muted-foreground">A 6-digit code was sent to <span className="font-medium text-foreground">{mobile}</span>.</p>
            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{6}"
                required
                className="text-center text-2xl tracking-[0.5em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
              <p className="text-xs text-muted-foreground">Demo: use <code className="rounded bg-muted px-1">123456</code>.</p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </CardContent>
        </Card>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Verifying…' : 'Verify'}
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-2 pt-6">
          <div className="flex items-baseline justify-between">
            <span>{service?.name ?? 'Consultation'}</span>
            <span className="text-lg font-semibold">{formatCurrency(feeMinor, currency)}</span>
          </div>
          <p className="text-xs text-muted-foreground">Mock payment for the demo. In production this becomes a real card checkout.</p>
        </CardContent>
      </Card>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={pay} className="w-full" disabled={loading}>
        {loading ? 'Confirming…' : `Pay ${formatCurrency(feeMinor, currency)} & confirm`}
      </Button>
    </div>
  );
}
