'use client';

import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AvailabilityDay = {
  /** "2026-08-04" */
  date: string;
  /** Number of open slots — 0 disables the day. */
  count: number;
};

/**
 * Short rail of upcoming days, plus a full-calendar escape hatch.
 *
 * The rail covers the common case (something in the next few days) in one tap.
 * The date input beside it is the "full calendar" the design calls for: a native
 * picker, so it inherits real keyboard and screen-reader support and the
 * platform's own month view rather than a bespoke grid.
 */
export function AvailabilityDayPicker({
  days,
  value,
  onSelect,
  min,
  max,
  className,
}: {
  days: AvailabilityDay[];
  value: string;
  onSelect: (date: string) => void;
  /** Bounds for the full-calendar input. */
  min?: string;
  max?: string;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2.5', className)}>
      <div className="rail" role="group" aria-label="Choose a day">
        {days.map((day) => {
          const date = new Date(day.date);
          const active = day.date === value;
          const disabled = day.count === 0;
          return (
            <button
              key={day.date}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onSelect(day.date)}
              aria-label={`${date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}${disabled ? ', no open times' : `, ${day.count} open`}`}
              className={cn(
                'press-scale flex min-h-[56px] min-w-[62px] flex-1 flex-col items-center justify-center rounded-control px-2 py-2 transition-colors',
                active && !disabled && 'bg-primary text-primary-foreground',
                !active && !disabled && 'border bg-surface hover:bg-muted',
                disabled && 'cursor-not-allowed border bg-muted/60 text-muted-foreground opacity-70',
              )}
            >
              <span className={cn('text-[11px]', active ? 'opacity-80' : 'text-muted-foreground')}>
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
              <span className="font-editorial text-[17px] font-semibold leading-tight tabular-nums">
                {date.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      <label className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-primary">
        <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
        <span>Pick another date</span>
        <input
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(event) => event.target.value && onSelect(event.target.value)}
          className="min-h-[44px] rounded-control border bg-surface px-2.5 text-[13px] font-medium text-foreground"
        />
      </label>
    </div>
  );
}
