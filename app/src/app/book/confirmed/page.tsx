import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarClock, CheckCircle2, MapPin, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BrandWordmark } from '@/components/domain/brand-mark';
import { InitialsAvatar } from '@/components/domain/avatar';
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
    <div className="min-h-screen">
      <header className="border-b bg-card/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/" aria-label="Home">
            <BrandWordmark />
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col items-center px-4 py-12 text-center">
        <div className="success-pop flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-8 ring-emerald-50">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">You&apos;re booked!</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          A confirmation has been sent. We&apos;ll see you at the clinic — a reminder will go out the day before.
        </p>

        <Card className="mt-8 w-full text-left">
          <CardContent className="space-y-5 pt-6">
            {doctor && (
              <div className="flex items-center gap-3">
                <InitialsAvatar name={`${doctor.firstName} ${doctor.lastName}`} size={48} />
                <div>
                  <p className="text-sm font-semibold">{doctor.title} {doctor.firstName} {doctor.lastName}</p>
                  <p className="text-xs text-muted-foreground">{doctor.specialty}</p>
                </div>
              </div>
            )}
            <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
              <Field
                icon={<CalendarClock className="h-4 w-4 text-primary" />}
                label="When"
                value={formatDateTime(booking.startAt.toISOString())}
              />
              <Field
                icon={<User className="h-4 w-4 text-primary" />}
                label="Service"
                value={service?.name ?? '—'}
              />
              <Field
                icon={<MapPin className="h-4 w-4 text-primary" />}
                label="Location"
                value="Clinic — Main Location"
              />
              <Field
                icon={<Sparkles className="h-4 w-4 text-primary" />}
                label="Paid"
                value={service ? formatCurrency(service.priceMinor, service.currency) : '—'}
              />
            </div>
            {booking.reason && (
              <div className="rounded-md bg-secondary/60 p-3 text-xs">
                <span className="font-semibold uppercase tracking-wide text-muted-foreground">Reason: </span>
                {booking.reason}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild variant="outline">
            <Link href="/doctors">Book another</Link>
          </Button>
          <Button asChild>
            <Link href="/account/appointments">My appointments</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
