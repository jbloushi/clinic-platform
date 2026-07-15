import type { AvailabilityRule, ISODate, ISODateTime, Slot } from '../types';
import { restJson } from './client';
import { toAppointment, type OpenEMRAppointmentDto } from './mappers';

/**
 * Free-slot computation for a practitioner across a date range.
 *
 * OpenEMR does not expose an availability endpoint — the standard REST API only
 * exposes booked appointments (`openemr_postcalendar_events`). Practitioner
 * availability lives in a separate schedule table plus event categories.
 *
 * Strategy for demo:
 *  - Availability rules are stored in the platform DB (per practitioner: dayOfWeek/start/end/slotMinutes).
 *  - We fetch all appointments in the range from OpenEMR.
 *  - We generate slots from availability and subtract overlapping appointments.
 *  - Before creating a real appointment, we re-fetch and check for conflicts to close the race window.
 */
export async function computeAvailableSlots(
  practitionerId: string,
  availability: AvailabilityRule[],
  from: ISODate,
  to: ISODate,
  overrideSlotMinutes?: number,
  numericId?: string,
): Promise<Slot[]> {
  const booked = await fetchBookedRanges(practitionerId, from, to, numericId);
  return generateSlotsFromBooked(practitionerId, availability, from, to, booked, overrideSlotMinutes);
}

/**
 * Fetch booked appointment ranges for a single practitioner in [from, to].
 *
 * OpenEMR ignores the pc_aid/date_start/date_end query filters server-side —
 * the response always contains every practitioner's appointments regardless
 * of what's requested. This MUST filter locally by numericId (the OpenEMR
 * user's numeric id, since that's what pc_aid actually contains on each
 * appointment row) or every doctor's booked time blocks every other doctor's
 * slots as "conflicted." If numericId isn't given, falls back to comparing
 * against practitionerId directly (only correct if practitionerId is itself
 * already numeric).
 *
 * Exported so bulk callers can skip this per-practitioner and instead fetch
 * the whole clinic's appointments once (see getAvailableSlotsBulk in
 * provider.ts), partitioning locally the same way.
 */
export async function fetchBookedRanges(
  practitionerId: string,
  from: ISODate,
  to: ISODate,
  numericId?: string,
): Promise<{ start: number; end: number }[]> {
  const expected = numericId ?? practitionerId;
  try {
    const q = { pc_aid: practitionerId, date_start: from, date_end: to };
    const raw = (await restJson<any>('/appointment', { query: q })) as
      | OpenEMRAppointmentDto[]
      | { data: OpenEMRAppointmentDto[] };
    const arr = Array.isArray(raw) ? raw : raw.data ?? [];
    return arr
      .map(toAppointment)
      .filter((a) => a.status !== 'cancelled' && a.practitionerId === expected)
      .map((a) => ({ start: +new Date(a.start), end: +new Date(a.end) }));
  } catch {
    // if the endpoint fails for any reason, still return generated slots so the UI is usable
    return [];
  }
}

/**
 * Pure slot generation: availability rules + already-known booked ranges ->
 * a Slot[] for [from, to]. No network call — this is the part
 * computeAvailableSlots and getAvailableSlotsBulk both need, factored out so
 * the bulk path can fetch booked appointments once for many practitioners
 * instead of once per practitioner.
 */
export function generateSlotsFromBooked(
  practitionerId: string,
  availability: AvailabilityRule[],
  from: ISODate,
  to: ISODate,
  booked: { start: number; end: number }[],
  overrideSlotMinutes?: number,
): Slot[] {
  const slots: Slot[] = [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay() as AvailabilityRule['dayOfWeek'];
    const rules = availability.filter((r) => r.dayOfWeek === dow);
    for (const r of rules) {
      const slotMin = overrideSlotMinutes ?? r.slotMinutes;
      const [sh, sm] = r.startTime.split(':').map(Number);
      const [eh, em] = r.endTime.split(':').map(Number);
      const dayStart = new Date(d);
      dayStart.setHours(sh, sm, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(eh, em, 0, 0);
      for (
        let t = new Date(dayStart);
        t.getTime() + slotMin * 60_000 <= dayEnd.getTime();
        t = new Date(t.getTime() + slotMin * 60_000)
      ) {
        const slotStart = t.getTime();
        const slotEnd = slotStart + slotMin * 60_000;
        const overlaps = booked.some((b) => b.start < slotEnd && b.end > slotStart);
        // Also drop past slots
        const inPast = slotStart < Date.now();
        slots.push({
          practitionerId,
          start: new Date(slotStart).toISOString() as ISODateTime,
          end: new Date(slotEnd).toISOString() as ISODateTime,
          available: !overlaps && !inPast,
        });
      }
    }
  }
  return slots;
}
