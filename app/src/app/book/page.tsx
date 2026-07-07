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
import { cn, formatDateTime } from '@/lib/utils';
import { specialtyColor } from '@/lib/specialty-colors';
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
  const color = specialtyColor(doctor.specialty);

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

        {/* Summary card */}
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-center gap-3">
              <InitialsAvatar name={`${doctor.firstName} ${doctor.lastName}`} gradient={color.avatar} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {doctor.title} {doctor.firstName} {doctor.lastName}
                </p>
                <span
                  className={cn(
                    'mt-0.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
                    color.pill,
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', color.dot)} />
                  {doctor.specialty}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-secondary/60 px-3 py-2 text-sm font-medium tabular-nums">
              <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
              {formatDateTime(start!)}
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
