import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  // Compute slots for the next 7 days starting at `date` (or today).
  const from = date ?? new Date().toISOString().slice(0, 10);
  const toDate = new Date(from);
  toDate.setDate(toDate.getDate() + 6);
  const to = toDate.toISOString().slice(0, 10);
  const slots = await dp.getAvailableSlots(id, from, to).catch(() => []);

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/doctors"><ChevronLeft className="h-4 w-4" /> All doctors</Link>
        </Button>
        <Button asChild variant="outline"><Link href="/login">Sign in</Link></Button>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>{doctor.title} {doctor.firstName} {doctor.lastName}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{doctor.specialty}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground">Consultation fee</p>
              <p className="text-lg font-semibold">{formatCurrency(doctor.consultationFeeMinor, doctor.currency)}</p>
            </div>
          </div>
        </CardHeader>
        {doctor.bio && (
          <CardContent>
            <p className="text-sm text-muted-foreground">{doctor.bio}</p>
          </CardContent>
        )}
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Book an appointment</h2>
        <SlotPicker
          practitionerId={doctor.id}
          practitionerName={`${doctor.title} ${doctor.firstName} ${doctor.lastName}`}
          from={from}
          slots={slots}
        />
      </section>
    </main>
  );
}
