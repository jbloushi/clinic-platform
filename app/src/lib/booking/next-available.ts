import type { DataProvider } from '@/lib/data/provider';
import type { ISODate, Slot } from '@/lib/data/types';

/** How far ahead to search for a doctor's next open slot. */
const SEARCH_WINDOW_DAYS = 14;

/**
 * The earliest open slot for a doctor at a branch, or null if nothing frees up
 * within the search window. One `getAvailableSlots` call already returns every
 * slot in the range — this only picks the first available one out of it.
 *
 * Defaults to the standard 14-day preview window; pass `range` to search a
 * patient-chosen window instead (the department flow's date-range step).
 */
export async function getNextAvailableSlot(
  dp: DataProvider,
  practitionerId: string,
  branchId: string,
  durationMinutes?: number,
  range?: { from: ISODate; to: ISODate },
): Promise<Pick<Slot, 'start' | 'end'> | null> {
  const from = range?.from ?? new Date().toISOString().slice(0, 10);
  const to = range?.to ?? new Date(Date.now() + SEARCH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const slots = await dp.getAvailableSlots(practitionerId, from, to, durationMinutes, { branchId });
  const next = slots
    .filter((s) => s.available && new Date(s.start) > new Date())
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  return next ? { start: next.start, end: next.end } : null;
}

export type DayAvailability = { date: ISODate; count: number };

/**
 * Same search as `getNextAvailableSlot`, but also buckets every available
 * slot by calendar day across the whole range — one `getAvailableSlots` call
 * covers both, so a caller that needs the day-by-day shape (not just the
 * single soonest slot) doesn't have to fetch twice. Every date in [from, to]
 * appears, including zero-count days, so a caller can render a fixed-width
 * strip without gaps.
 */
export async function getAvailabilitySummary(
  dp: DataProvider,
  practitionerId: string,
  branchId: string,
  durationMinutes?: number,
  range?: { from: ISODate; to: ISODate },
): Promise<{ nextSlot: Pick<Slot, 'start' | 'end'> | null; days: DayAvailability[] }> {
  const from = range?.from ?? new Date().toISOString().slice(0, 10);
  const to = range?.to ?? new Date(Date.now() + SEARCH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const slots = await dp.getAvailableSlots(practitionerId, from, to, durationMinutes, { branchId });
  const available = slots.filter((s) => s.available && new Date(s.start) > new Date());
  const nextSlot = [...available].sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;

  const counts = new Map<string, number>();
  for (const s of available) {
    const date = s.start.slice(0, 10);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  const days: DayAvailability[] = [];
  for (let d = new Date(`${from}T00:00:00`); d <= new Date(`${to}T00:00:00`); d.setDate(d.getDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    days.push({ date, count: counts.get(date) ?? 0 });
  }

  return { nextSlot: nextSlot ? { start: nextSlot.start, end: nextSlot.end } : null, days };
}
