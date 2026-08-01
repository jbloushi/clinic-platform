'use client';

import { Card, CardContent } from '@/components/ui/card';
import { DoctorAvatar } from '@/components/domain/avatar';
import { cn, formatCurrency, formatTime } from '@/lib/utils';

export type PreviewSlot = { start: string; end: string };

/**
 * One doctor's card in a doctor list: identity + up to 5 real, tappable
 * times (one per day, earliest first) instead of a single "next available"
 * line or an at-a-glance-only heatmap. A patient who sees a time they want
 * can act on it directly from the list; "More times" is only needed when
 * none of the 5 previewed days work.
 *
 * Shared between the department/service flow (service — and so price/
 * duration — already chosen, a slot tap books immediately) and the
 * doctor-first flow (service not chosen yet, a slot tap instead carries the
 * picked date into the service step). `priceMinor` absent means "don't show
 * a price badge" — the doctor-first list's honest state before a service is
 * picked, not a bug.
 */
export function DoctorAvailabilityCard({
  name,
  specialty,
  photoUrl,
  previewSlots,
  priceMinor,
  currency = 'KWD',
  highlight,
  reservingSlotStart,
  onSlotClick,
  onMoreTimes,
  moreTimesLabel = 'More times',
}: {
  name: string;
  specialty: string;
  photoUrl: string | null;
  previewSlots: PreviewSlot[];
  /** Omit when no service is chosen yet (doctor-first path) — hides the price badge. */
  priceMinor?: number;
  currency?: string;
  highlight?: boolean;
  /** The `start` of whichever preview slot is mid-reservation, so only that button shows a busy state. */
  reservingSlotStart?: string | null;
  onSlotClick: (slot: PreviewSlot) => void;
  onMoreTimes: () => void;
  moreTimesLabel?: string;
}) {
  return (
    <Card className={highlight ? 'border-[1.5px] border-primary' : undefined}>
      <CardContent className="flex flex-col gap-3.5 pt-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <DoctorAvatar name={name} specialty={specialty} photoUrl={photoUrl} size={46} />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold">{name}</p>
              <p className="truncate text-[12px] text-muted-foreground">{specialty}</p>
            </div>
          </div>
          {priceMinor != null && (
            <p className="shrink-0 text-[13px] font-semibold tabular-nums">{formatCurrency(priceMinor, currency)}</p>
          )}
        </div>

        {previewSlots.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">No availability in this range</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {previewSlots.map((slot) => (
              <button
                key={slot.start}
                type="button"
                disabled={reservingSlotStart === slot.start}
                onClick={() => onSlotClick(slot)}
                className="press-scale flex min-h-[52px] min-w-[68px] flex-col items-center justify-center rounded-control border bg-surface px-2.5 py-1.5 text-center hover:border-primary hover:bg-tint-teal disabled:opacity-60"
              >
                <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
                  {formatDayLabel(slot.start)}
                </span>
                <span className="mt-0.5 text-[12.5px] font-semibold tabular-nums">
                  {reservingSlotStart === slot.start ? '…' : formatTime(slot.start)}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={onMoreTimes}
              className={cn(
                'press-scale flex min-h-[52px] min-w-[68px] items-center justify-center rounded-control border border-dashed bg-surface px-2.5 text-center text-[12px] font-semibold text-primary hover:border-primary hover:bg-tint-teal',
              )}
            >
              {moreTimesLabel}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatDayLabel(startIso: string): string {
  const date = new Date(startIso);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
}
