import Link from 'next/link';
import { CalendarPlus } from 'lucide-react';
import { AppointmentCard } from '@/components/domain/appointment-card';
import { AppointmentActions } from '@/components/domain/appointment-actions';
import { EmptyState } from '@/components/domain/states';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/db';
import { requirePatient } from '@/lib/auth/guards';
import { getDataProvider } from '@/lib/data';
import { cn } from '@/lib/utils';
import type { AppointmentStatus, Practitioner } from '@/lib/data/types';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'My visits' };

type Tab = 'upcoming' | 'past';

/**
 * `BookingHold.status` is a free-form string column. Map it onto the domain
 * status union so the shared badge and card treatments apply, rather than
 * casting and hoping the strings line up.
 */
function toAppointmentStatus(value: string): AppointmentStatus {
  switch (value) {
    case 'held':
    case 'pending_payment':
    case 'confirmed':
    case 'checked_in':
    case 'completed':
    case 'cancelled':
    case 'no_show':
      return value;
    // A hold whose window lapsed reads as cancelled to the patient — they no
    // longer have the slot, and "expired" isn't a state they chose.
    case 'expired':
      return 'cancelled';
    default:
      return 'draft';
  }
}

export default async function MyAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab: Tab = tabParam === 'past' ? 'past' : 'upcoming';

  const patient = await requirePatient();
  const dp = getDataProvider();

  const now = new Date();
  const bookings = await prisma.bookingHold.findMany({
    where: {
      patientIdentityId: patient.id,
      ...(tab === 'upcoming'
        ? { startAt: { gte: now }, status: { in: ['confirmed', 'held', 'pending_payment', 'checked_in'] } }
        : { OR: [{ startAt: { lt: now } }, { status: { in: ['cancelled', 'expired', 'completed', 'no_show'] } }] }),
    },
    orderBy: { startAt: tab === 'upcoming' ? 'asc' : 'desc' },
    take: 50,
  });

  const doctorIds = Array.from(new Set(bookings.map((b) => b.practitionerOpenemrId)));
  const serviceIds = Array.from(new Set(bookings.map((b) => b.serviceId)));
  const [doctors, services] = await Promise.all([
    Promise.all(doctorIds.map((id) => dp.getPractitionerById(id).catch(() => null))),
    prisma.service.findMany({ where: { id: { in: serviceIds } } }),
  ]);

  const doctorMap = new Map<string, Practitioner>(
    doctors.filter((d): d is Practitioner => Boolean(d)).map((d) => [d.id, d]),
  );
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-editorial text-[22px] font-semibold">My visits</h1>
        <Button asChild size="sm" className="rounded-control">
          <Link href="/book/v2">
            <CalendarPlus className="h-4 w-4" />
            Book
          </Link>
        </Button>
      </div>

      <nav className="mt-3.5 flex gap-6 border-b" aria-label="Visit history">
        <TabLink tab="upcoming" active={tab === 'upcoming'} label="Upcoming" />
        <TabLink tab="past" active={tab === 'past'} label="Past" />
      </nav>

      <div className="mt-4 space-y-3.5">
        {bookings.length === 0 ? (
          <div className="rounded-card border bg-surface">
            <EmptyState
              title={tab === 'upcoming' ? 'No upcoming appointments' : 'No past visits yet'}
              description={
                tab === 'upcoming'
                  ? 'When you book a visit it will appear here with everything you need for the day.'
                  : 'Visits you have already attended will be listed here.'
              }
              action={
                tab === 'upcoming' ? (
                  <Button asChild className="rounded-control">
                    <Link href="/doctors">Find a doctor</Link>
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          bookings.map((booking) => {
            const doctor = doctorMap.get(booking.practitionerOpenemrId);
            const status = toAppointmentStatus(booking.status);
            const upcoming = booking.startAt >= now && status !== 'cancelled';

            return (
              <AppointmentCard
                key={booking.id}
                start={booking.startAt.toISOString()}
                status={status}
                doctorName={
                  doctor ? `${doctor.title} ${doctor.firstName} ${doctor.lastName}`.trim() : undefined
                }
                doctorSpecialty={doctor?.specialty}
                doctorPhotoUrl={doctor?.photoUrl}
                serviceName={serviceMap.get(booking.serviceId)?.name}
                footer={
                  upcoming ? (
                    <AppointmentActions
                      bookingId={booking.id}
                      rescheduleHref={`/account/appointments/${booking.id}/reschedule`}
                    />
                  ) : status === 'completed' ? (
                    // A finished visit is the natural place to continue a case,
                    // so the rebook carries the original forward rather than
                    // starting an unrelated appointment.
                    <Link
                      href={`/doctors/${booking.practitionerOpenemrId}?serviceId=${booking.serviceId}&followUpFrom=${booking.id}#booking`}
                      className="flex min-h-[48px] items-center justify-center px-4 text-[13px] font-semibold text-primary hover:bg-tint-teal"
                    >
                      Book a follow-up
                    </Link>
                  ) : undefined
                }
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function TabLink({ tab, active, label }: { tab: Tab; active: boolean; label: string }) {
  return (
    <Link
      href={`/account/appointments?tab=${tab}`}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'min-h-[44px] border-b-2 pb-3 pt-2 text-[14px] transition-colors',
        active
          ? 'border-primary font-semibold text-primary'
          : 'border-transparent font-medium text-placeholder hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );
}
