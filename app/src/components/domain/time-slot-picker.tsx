'use client';

import { Sun, Sunrise, Sunset } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn, formatTime } from '@/lib/utils';
import { EmptyState } from './states';
import type { Slot } from '@/lib/data/types';

type Bucket = { key: string; label: string; icon: LucideIcon; slots: Slot[] };

/**
 * Time slots grouped into morning, afternoon and evening.
 *
 * Unavailable slots are rendered rather than hidden — struck through and
 * disabled — because seeing that 10:30 is taken is what makes the remaining
 * times feel trustworthy. They stay out of the tab order.
 */
export function TimeSlotPicker({
  slots,
  selectedStart,
  onSelect,
  emptyDescription = 'Try another day, or pick a different date from the calendar.',
  className,
}: {
  /** All slots for the chosen day, available and not. */
  slots: Slot[];
  selectedStart?: string;
  onSelect: (slot: Slot) => void;
  emptyDescription?: string;
  className?: string;
}) {
  const buckets = bucketSlots(slots);
  const hasAny = slots.some((slot) => slot.available);

  if (!hasAny) {
    return <EmptyState title="No open times on this day" description={emptyDescription} />;
  }

  return (
    <div className={cn('space-y-4', className)}>
      {buckets.map((bucket) => {
        if (bucket.slots.length === 0) return null;
        const openCount = bucket.slots.filter((slot) => slot.available).length;
        return (
          <section key={bucket.key}>
            <h3 className="mb-2 flex items-center gap-2">
              <bucket.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {bucket.label}
              </span>
              <span className="ms-auto text-[11px] tabular-nums text-muted-foreground">
                {openCount} open
              </span>
            </h3>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
              {bucket.slots.map((slot) => {
                const selected = slot.start === selectedStart;
                return (
                  <button
                    key={slot.start}
                    type="button"
                    disabled={!slot.available}
                    tabIndex={slot.available ? undefined : -1}
                    aria-pressed={selected}
                    aria-label={`${formatTime(slot.start)}${slot.available ? '' : ' — unavailable'}`}
                    onClick={() => onSelect(slot)}
                    className={cn(
                      'press-scale flex min-h-[44px] items-center justify-center rounded-control text-[13.5px] font-semibold tabular-nums transition-colors',
                      !slot.available &&
                        'cursor-not-allowed border bg-muted/70 text-muted-foreground line-through',
                      slot.available &&
                        !selected &&
                        'border bg-surface text-foreground/80 hover:border-primary hover:bg-tint-teal hover:text-primary',
                      selected && 'border-[1.5px] border-primary bg-surface font-bold text-primary',
                    )}
                  >
                    {formatTime(slot.start)}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function bucketSlots(slots: Slot[]): Bucket[] {
  const morning: Slot[] = [];
  const afternoon: Slot[] = [];
  const evening: Slot[] = [];
  for (const slot of slots) {
    const hour = new Date(slot.start).getHours();
    if (hour < 12) morning.push(slot);
    else if (hour < 17) afternoon.push(slot);
    else evening.push(slot);
  }
  const byStart = (a: Slot, b: Slot) => a.start.localeCompare(b.start);
  return [
    { key: 'morning', label: 'Morning', icon: Sunrise, slots: morning.sort(byStart) },
    { key: 'afternoon', label: 'Afternoon', icon: Sun, slots: afternoon.sort(byStart) },
    { key: 'evening', label: 'Evening', icon: Sunset, slots: evening.sort(byStart) },
  ];
}
