import { formatNextAvailable, type NextAvailable } from '@/lib/specialist-meta';
import type { DataProvider } from '@/lib/data/provider';
import type { Practitioner, Slot } from '@/lib/data/types';

/**
 * "Next available" hints for a roster of specialists.
 *
 * Availability is always computed by the provider layer — this helper only asks
 * for a window and picks the first open slot, so the directory, the homepage and
 * search all show the same answer. A per-specialist failure is swallowed: one
 * unreachable schedule shouldn't blank the whole list, it just means that card
 * shows no hint.
 */
export async function getNextAvailableMap(
  dp: DataProvider,
  specialists: Practitioner[],
  { days = 7, from = new Date() }: { days?: number; from?: Date } = {},
): Promise<Record<string, NextAvailable>> {
  const fromDate = from.toISOString().slice(0, 10);
  const to = new Date(from);
  to.setDate(to.getDate() + days - 1);
  const toDate = to.toISOString().slice(0, 10);

  const map: Record<string, NextAvailable> = {};
  await Promise.all(
    specialists.map(async (specialist) => {
      try {
        const slots = await dp.getAvailableSlots(specialist.id, fromDate, toDate);
        const first = firstOpenSlot(slots);
        if (first) {
          map[specialist.id] = { iso: first.start, label: formatNextAvailable(first.start) };
        }
      } catch {
        // Leave this specialist without a hint rather than failing the page.
      }
    }),
  );
  return map;
}

/** Earliest open slot, regardless of the order the provider returned them in. */
export function firstOpenSlot(slots: Slot[]): Slot | undefined {
  let earliest: Slot | undefined;
  for (const slot of slots) {
    if (!slot.available) continue;
    if (!earliest || slot.start < earliest.start) earliest = slot;
  }
  return earliest;
}

/**
 * Specialists ordered by how soon they can be seen, for the homepage's
 * earliest-available list. Specialists with no upcoming slot sort last.
 */
export function bySoonestAvailable(
  nextAvailable: Record<string, NextAvailable>,
): (a: Practitioner, b: Practitioner) => number {
  return (a, b) => {
    const left = nextAvailable[a.id]?.iso;
    const right = nextAvailable[b.id]?.iso;
    if (left && right) return left.localeCompare(right);
    if (left) return -1;
    if (right) return 1;
    return 0;
  };
}
