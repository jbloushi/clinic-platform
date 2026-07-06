import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, ChevronLeft, Clock, ShieldCheck, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandWordmark } from '@/components/domain/brand-mark';
import { InitialsAvatar } from '@/components/domain/avatar';
import { getDataProvider } from '@/lib/data';
import { formatCurrency } from '@/lib/utils';
import { SlotPicker } from './slot-picker';

export const dynamic = 'force-dynamic';

export default async function DoctorProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date } = await searchParams;
  const dp = getDataProvider();
  const doctor = await dp.getPractitionerById(id);
  if (!doctor) notFound();

  const from = date ?? new Date().toISOString().slice(0, 10);
  const toDate = new Date(from);
  toDate.setDate(toDate.getDate() + 6);
  const to = toDate.toISOString().slice(0, 10);
  const slots = await dp.getAvailableSlots(id, from, to).catch(() => []);

  const fullName = `${doctor.title} ${doctor.firstName} ${doctor.lastName}`.trim();

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/" aria-label="Home">
            <BrandWordmark />
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <Button variant="ghost" size="sm" asChild className="w-fit">
          <Link href="/doctors">
            <ChevronLeft className="h-4 w-4" /> All doctors
          </Link>
        </Button>

        <Card className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <InitialsAvatar name={`${doctor.firstName} ${doctor.lastName}`} size={64} />
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{fullName}</h1>
                  <p className="mt-0.5 text-sm text-muted-foreground">{doctor.specialty}</p>
                  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <li className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                      Verified practitioner
                    </li>
                    <li className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-primary" aria-hidden />
                      Books this week
                    </li>
                  </ul>
                </div>
              </div>
              <div className="rounded-lg border bg-secondary/50 p-3 text-right sm:min-w-[160px]">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Consultation fee
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatCurrency(doctor.consultationFeeMinor, doctor.currency)}
                </p>
              </div>
            </div>
            {doctor.bio && (
              <p className="mt-6 border-t pt-4 text-sm leading-relaxed text-muted-foreground">
                {doctor.bio}
              </p>
            )}
          </CardContent>
        </Card>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Book an appointment</h2>
            <p className="text-xs text-muted-foreground">Choose a time that works for you</p>
          </div>
          <SlotPicker practitionerId={doctor.id} practitionerName={fullName} from={from} slots={slots} />
        </section>

        <p className="flex items-center justify-center gap-1.5 pt-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
          Confirmation is instant — you&apos;ll receive it right after payment
        </p>
      </main>
    </div>
  );
}
