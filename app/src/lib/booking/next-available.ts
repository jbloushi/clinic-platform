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

export type PreviewSlot = Pick<Slot, 'start' | 'end'>;

/** How many distinct days' earliest slot to surface as quick-book buttons. */
const DEFAULT_PREVIEW_DAYS = 5;

/**
 * Same search as `getNextAvailableSlot`, but also returns up to
 * `maxPreviewDays` "quick pick" slots — one per day, earliest first, across
 * up to that many distinct days — so a doctor card can offer real tappable
 * times ("Today 2:00", "Tomorrow 10:30", "Thu 9:00"...) instead of a single
 * "next available" line. One `getAvailableSlots` call covers both — no
 * separate fetch needed for the preview.
 */
export async function getAvailabilitySummary(
  dp: DataProvider,
  practitionerId: string,
  branchId: string,
  durationMinutes?: number,
  range?: { from: ISODate; to: ISODate },
  maxPreviewDays: number = DEFAULT_PREVIEW_DAYS,
): Promise<{ nextSlot: PreviewSlot | null; previewSlots: PreviewSlot[] }> {
  const from = range?.from ?? new Date().toISOString().slice(0, 10);
  const to = range?.to ?? new Date(Date.now() + SEARCH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const slots = await dp.getAvailableSlots(practitionerId, from, to, durationMinutes, { branchId });
  const available = slots
    .filter((s) => s.available && new Date(s.start) > new Date())
    .sort((a, b) => a.start.localeCompare(b.start));
  const nextSlot = available[0] ?? null;

  const earliestByDate = new Map<string, PreviewSlot>();
  for (const s of available) {
    const date = s.start.slice(0, 10);
    if (!earliestByDate.has(date)) earliestByDate.set(date, { start: s.start, end: s.end });
  }
  const previewSlots = [...earliestByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, maxPreviewDays)
    .map(([, slot]) => slot);

  return { nextSlot: nextSlot ? { start: nextSlot.start, end: nextSlot.end } : null, previewSlots };
}
