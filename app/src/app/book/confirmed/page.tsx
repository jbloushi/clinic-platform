import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { prisma } from '@/lib/db';
import { getDataProvider } from '@/lib/data';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ConfirmedPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  if (!id) redirect('/doctors');
  const booking = await prisma.bookingHold.findUnique({ where: { id } });
  if (!booking) redirect('/doctors');
  const [doctor, service] = await Promise.all([
    getDataProvider().getPractitionerById(booking.practitionerOpenemrId).catch(() => null),
    prisma.service.findUnique({ where: { id: booking.serviceId } }),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <div className="rounded-full bg-emerald-100 p-3 text-emerald-700">
        <Check className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-semibold">You&apos;re booked</h1>
      <Card className="w-full text-left">
        <CardContent className="space-y-3 pt-6 text-sm">
          <Field label="Doctor" value={doctor ? `${doctor.title} ${doctor.firstName} ${doctor.lastName} — ${doctor.specialty}` : '—'} />
          <Field label="Service" value={service?.name} />
          <Field label="When" value={formatDateTime(booking.startAt.toISOString())} />
          <Field label="Paid" value={service ? formatCurrency(service.priceMinor, service.currency) : undefined} />
          {booking.reason && <Field label="Reason" value={booking.reason} />}
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button asChild variant="outline"><Link href="/doctors">Book another</Link></Button>
        <Button asChild><Link href="/account/appointments">My appointments</Link></Button>
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value || '—'}</p>
    </div>
  );
}
