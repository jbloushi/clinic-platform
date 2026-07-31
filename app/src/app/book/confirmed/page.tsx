import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarPlus, Check, IdCard, LifeBuoy } from 'lucide-react';
import { DoctorAvatar } from '@/components/domain/avatar';
import { PatientMobileNav } from '@/components/domain/patient-mobile-nav';
import { prisma } from '@/lib/db';
import { getDataProvider } from '@/lib/data';
import { formatTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) redirect('/doctors');
  const booking = await prisma.bookingHold.findUnique({ where: { id } });
  if (!booking) redirect('/doctors');

  const [doctor, service] = await Promise.all([
    getDataProvider().getPractitionerById(booking.practitionerOpenemrId).catch(() => null),
    prisma.service.findUnique({ where: { id: booking.serviceId } }),
  ]);

  const awaitingPayment = booking.status === 'pending_payment' || booking.status === 'held';
  const reference = `AJ-${booking.id.slice(-4).toUpperCase()}`;
  const when = booking.startAt.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="has-mobile-nav brand-gradient flex min-h-screen flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-5 pt-14 text-center text-surface-soft">
        <div className="success-pop flex h-[88px] w-[88px] items-center justify-center rounded-full border-[1.5px] border-accent bg-white/10">
          <span className="accent-gradient flex h-[60px] w-[60px] items-center justify-center rounded-full text-primary-dark">
            <Check className="h-8 w-8" strokeWidth={3} aria-hidden />
          </span>
        </div>
        <h1 className="mt-6 font-editorial text-[28px] font-semibold">
          {awaitingPayment ? 'Your slot is reserved.' : 'You’re booked.'}
        </h1>
        <p className="mt-2 max-w-[32ch] text-[14px] leading-relaxed text-surface-soft/80">
          {awaitingPayment
            ? 'Payment is taken at reception when you arrive. Your appointment details are below.'
            : 'Your appointment is confirmed. You can review or change it any time under My visits.'}
        </p>
      </main>

      <div className="rounded-t-[26px] bg-background px-5 pb-9 pt-6 md:px-8">
        <div className="mx-auto max-w-md">
          <div className="rounded-card border bg-surface p-[18px]">
            <div className="flex items-center gap-3.5 border-b border-muted pb-4">
              <DoctorAvatar
                name={doctor ? `${doctor.firstName} ${doctor.lastName}` : 'Specialist'}
                specialty={doctor?.specialty}
                photoUrl={doctor?.photoUrl}
                size={48}
              />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold">
                  {doctor
                    ? `${doctor.title} ${doctor.firstName} ${doctor.lastName}`.trim()
                    : 'Any available specialist'}
                </p>
                {doctor?.specialty && (
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                    {doctor.specialty}
                  </p>
                )}
              </div>
            </div>

            <dl className="flex gap-3 pt-4">
              <Detail label="Date & time" value={`${when} · ${formatTime(booking.startAt.toISOString())}`} />
              <Detail label="Service" value={service?.name ?? '—'} />
              <Detail label="Ref" value={reference} />
            </dl>
          </div>

          <div className="mt-4 flex gap-2.5">
            <a
              href={`/api/bookings/${booking.id}/calendar`}
              className="press-scale flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-control border bg-surface px-3 text-[13px] font-semibold text-primary hover:bg-tint-teal"
            >
              <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden />
              Add to calendar
            </a>
            <Link
              href="/account/appointments"
              className="press-scale flex min-h-[48px] flex-1 items-center justify-center rounded-control bg-primary px-3 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              View appointment
            </Link>
          </div>

          <p className="mt-4 flex gap-2.5 rounded-control border border-tint-gold-border bg-tint-gold p-3.5 text-[12.5px] leading-relaxed text-accent-foreground">
            <IdCard className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <b>Before you visit:</b> bring your Civil ID and arrive about 10 minutes early so
              reception can check you in. Your specialist will explain any preparation you need at
              or before the visit.
            </span>
          </p>

          <p className="mt-3.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[12.5px] text-muted-foreground">
            <LifeBuoy className="h-4 w-4 shrink-0" aria-hidden />
            Need to change something?{' '}
            <Link
              href={`/account/appointments/${booking.id}/reschedule`}
              className="font-semibold text-primary hover:underline"
            >
              Reschedule
            </Link>
            <span aria-hidden>·</span>
            <Link href="/account/appointments" className="font-semibold text-primary hover:underline">
              Manage in My visits
            </Link>
          </p>
        </div>
      </div>

      <PatientMobileNav />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-[13.5px] font-semibold">{value}</dd>
    </div>
  );
}
