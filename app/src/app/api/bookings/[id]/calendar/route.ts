import { prisma } from '@/lib/db';
import { getDataProvider } from '@/lib/data';
import { CLINIC_NAME } from '@/components/domain/brand-mark';

/**
 * iCalendar file for a confirmed booking — the "Add to calendar" action.
 *
 * Deliberately minimal: what, when, where and the reference. No clinical detail
 * goes into a calendar entry, because those sync to devices and third-party
 * calendar services outside the clinic's control.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const booking = await prisma.bookingHold.findUnique({ where: { id } });
  if (!booking) {
    return new Response('Not found', { status: 404 });
  }

  const [doctor, service] = await Promise.all([
    getDataProvider()
      .getPractitionerById(booking.practitionerOpenemrId)
      .catch(() => null),
    prisma.service.findUnique({ where: { id: booking.serviceId } }),
  ]);

  const doctorName = doctor
    ? `${doctor.title} ${doctor.firstName} ${doctor.lastName}`.trim()
    : 'your specialist';
  const summary = `${service?.name ?? 'Appointment'} · ${CLINIC_NAME}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dr. Al Jarallah Clinic//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${booking.id}@draljarallah.clinic`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(booking.startAt)}`,
    `DTEND:${toIcsDate(booking.endAt)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(`Appointment with ${doctorName}. Reference ${reference(booking.id)}. Please bring your Civil ID.`)}`,
    `LOCATION:${escapeIcs(CLINIC_NAME)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(summary)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="appointment-${reference(booking.id)}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}

/** Short patient-facing reference, matching the confirmation screen. */
function reference(id: string): string {
  return `AJ-${id.slice(-4).toUpperCase()}`;
}

function toIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** RFC 5545 text escaping. */
function escapeIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
