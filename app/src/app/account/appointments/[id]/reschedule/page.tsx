import { notFound, redirect } from 'next/navigation';
import { BookShell } from '@/components/domain/book-shell';
import { prisma } from '@/lib/db';
import { requirePatient } from '@/lib/auth/guards';
import { getDataProvider } from '@/lib/data';
import { getBookableService } from '@/lib/data/service-catalog';
import { formatTime } from '@/lib/utils';
import { RescheduleFlow } from './reschedule-flow';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Reschedule visit' };

const CHANGEABLE = new Set(['held', 'pending_payment', 'confirmed']);

/**
 * Move an existing booking to a new time with the same specialist.
 *
 * The doctor is fixed here on purpose — changing who you see is a different
 * decision from changing when, and it starts a fresh booking rather than
 * editing this one.
 */
export default async function ReschedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await requirePatient();

  const booking = await prisma.bookingHold.findFirst({
    where: { id, patientIdentityId: patient.id },
  });
  if (!booking) notFound();
  if (!CHANGEABLE.has(booking.status) || booking.startAt.getTime() <= Date.now()) {
    redirect('/account/appointments');
  }

  const dp = getDataProvider();
  const [doctor, service] = await Promise.all([
    dp.getPractitionerById(booking.practitionerOpenemrId).catch(() => null),
    getBookableService(booking.serviceId),
  ]);

  const from = toDateKey(new Date());
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + 13);
  const slots = await dp
    .getAvailableSlots(booking.practitionerOpenemrId, from, toDateKey(windowEnd), service?.durationMinutes, {
      // Same branch as the original visit — a reschedule moves the time, not
      // the location, so offering times from another site would be wrong.
      branchId: booking.branchId ?? undefined,
    })
    .catch(() => []);

  const doctorName = doctor
    ? `${doctor.title} ${doctor.firstName} ${doctor.lastName}`.trim()
    : 'your specialist';
  const currently = `${booking.startAt.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })} · ${formatTime(booking.startAt.toISOString())}`;

  return (
    <BookShell
      backHref="/account/appointments"
      backLabel="Back to my visits"
      title="Choose a new time"
      description={`Currently ${currently} with ${doctorName}. Pick a replacement below — your original time is released only once the new one is confirmed.`}
    >
      <RescheduleFlow
        bookingId={booking.id}
        doctorName={doctorName}
        serviceName={service?.name}
        slots={slots.filter((slot) => slot.available)}
        currentStart={booking.startAt.toISOString()}
      />
    </BookShell>
  );
}

/** Local-date key, avoiding the UTC shift `toISOString()` introduces. */
function toDateKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
