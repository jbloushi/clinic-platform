import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/domain/page-header';
import { getDataProvider } from '@/lib/data';
import { prisma } from '@/lib/db';
import { formatDateTime } from '@/lib/utils';
import { BookingForm } from './form';

export const dynamic = 'force-dynamic';

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ practitionerId?: string; start?: string; end?: string }>;
}) {
  const { practitionerId, start, end } = await searchParams;
  if (!practitionerId || !start || !end) redirect('/doctors');

  const doctor = await getDataProvider().getPractitionerById(practitionerId);
  if (!doctor) redirect('/doctors');
  const services = await prisma.service.findMany({ where: { active: true } });

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href={`/doctors/${practitionerId}`}><ChevronLeft className="h-4 w-4" /> Change slot</Link>
      </Button>
      <PageHeader title="Confirm your appointment" description="A few details and you're set." />

      <Card>
        <CardContent className="space-y-1 pt-6 text-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Doctor</p>
          <p className="font-medium">{doctor.title} {doctor.firstName} {doctor.lastName} — {doctor.specialty}</p>
          <p className="pt-3 text-xs uppercase tracking-wide text-muted-foreground">Date &amp; time</p>
          <p className="font-medium">{formatDateTime(start!)}</p>
        </CardContent>
      </Card>

      <BookingForm
        practitionerId={practitionerId!}
        start={start!}
        end={end!}
        consultationFeeMinor={doctor.consultationFeeMinor}
        currency={doctor.currency}
        services={services.map((s) => ({ id: s.id, name: s.name, durationMinutes: s.durationMinutes, priceMinor: s.priceMinor }))}
      />
    </main>
  );
}
