import type { DataProvider } from '@/lib/data/provider';
import type { Slot } from '@/lib/data/types';

/** How far ahead to search for a doctor's next open slot. */
const SEARCH_WINDOW_DAYS = 14;

/**
 * The earliest open slot for a doctor at a branch, or null if nothing frees up
 * within the search window. One `getAvailableSlots` call already returns every
 * slot in the range — this only picks the first available one out of it.
 */
export async function getNextAvailableSlot(
  dp: DataProvider,
  practitionerId: string,
  branchId: string,
  durationMinutes?: number,
): Promise<Pick<Slot, 'start' | 'end'> | null> {
  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + SEARCH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const slots = await dp.getAvailableSlots(practitionerId, from, to, durationMinutes, { branchId });
  const next = slots
    .filter((s) => s.available && new Date(s.start) > new Date())
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  return next ? { start: next.start, end: next.end } : null;
}
