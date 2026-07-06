import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarClock, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/domain/page-header';
import { BrandWordmark } from '@/components/domain/brand-mark';
import { InitialsAvatar } from '@/components/domain/avatar';
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
    <div className="min-h-screen">
      <header className="border-b bg-card/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/" aria-label="Home">
            <BrandWordmark />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Button variant="ghost" size="sm" asChild className="w-fit">
          <Link href={`/doctors/${practitionerId}`}>
            <ChevronLeft className="h-4 w-4" /> Change slot
          </Link>
        </Button>

        <PageHeader
          eyebrow="Book appointment"
          title="Confirm your appointment"
          description="A few details and you're set."
        />

        {/* Sticky-ish summary card */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-center gap-4">
              <InitialsAvatar name={`${doctor.firstName} ${doctor.lastName}`} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {doctor.title} {doctor.firstName} {doctor.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{doctor.specialty}</p>
              </div>
              <div className="rounded-md bg-secondary/60 px-3 py-1.5 text-sm font-medium tabular-nums">
                <CalendarClock className="mr-1.5 inline-block h-3.5 w-3.5 -translate-y-px text-primary" />
                {formatDateTime(start!)}
              </div>
            </div>
          </CardContent>
        </Card>

        <BookingForm
          practitionerId={practitionerId!}
          start={start!}
          end={end!}
          consultationFeeMinor={doctor.consultationFeeMinor}
          currency={doctor.currency}
          services={services.map((s) => ({
            id: s.id,
            name: s.name,
            durationMinutes: s.durationMinutes,
            priceMinor: s.priceMinor,
          }))}
        />
      </main>
    </div>
  );
}
