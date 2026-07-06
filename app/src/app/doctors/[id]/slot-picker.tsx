'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Sunrise, Sun, Sunset } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/domain/states';
import { cn } from '@/lib/utils';
import type { Slot } from '@/lib/data/types';

export function SlotPicker({
  practitionerId,
  practitionerName,
  from,
  slots,
}: {
  practitionerId: string;
  practitionerName: string;
  from: string;
  slots: Slot[];
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(() => firstDateWithAvailability(slots, from));

  const byDate = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots) {
      const d = s.start.slice(0, 10);
      const arr = m.get(d) ?? [];
      arr.push(s);
      m.set(d, arr);
    }
    return m;
  }, [slots]);

  const days = useMemo(() => {
    const list: string[] = [];
    const start = new Date(from);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      list.push(d.toISOString().slice(0, 10));
    }
    return list;
  }, [from]);

  const today = new Date().toISOString().slice(0, 10);
  const daySlots = (byDate.get(selectedDate) ?? []).filter((s) => s.available);
  const buckets = useMemo(() => bucketSlots(daySlots), [daySlots]);

  function shift(delta: number) {
    const d = new Date(from);
    d.setDate(d.getDate() + delta);
    router.push(`/doctors/${practitionerId}?date=${d.toISOString().slice(0, 10)}`);
  }

  return (
    <div className="space-y-4">
      {/* Day strip */}
      <div className="flex items-stretch gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => shift(-7)}
          aria-label="Previous week"
          className="shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="grid flex-1 grid-cols-7 gap-1.5">
          {days.map((d) => {
            const dayAvailable = (byDate.get(d) ?? []).filter((s) => s.available);
            const count = dayAvailable.length;
            const active = d === selectedDate;
            const isToday = d === today;
            const date = new Date(d);
            const disabled = count === 0;
            return (
              <button
                key={d}
                type="button"
                onClick={() => !disabled && setSelectedDate(d)}
                disabled={disabled}
                aria-pressed={active}
                aria-label={`${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${
                  count ? `, ${count} slots available` : ', no slots'
                }`}
                className={cn(
                  'group relative flex flex-col items-center rounded-lg border px-2 py-2.5 text-center transition-all',
                  active && !disabled && 'border-primary bg-primary/10 text-primary shadow-sm',
                  !active && !disabled && 'hover:border-primary/40 hover:bg-accent',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className="mt-0.5 text-lg font-semibold leading-none tabular-nums">
                  {date.getDate()}
                </span>
                {isToday && (
                  <span className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-primary">
                    Today
                  </span>
                )}
                {!isToday && count > 0 && (
                  <span className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                    {count} slot{count === 1 ? '' : 's'}
                  </span>
                )}
                {!isToday && count === 0 && (
                  <span className="mt-1 text-[10px] text-muted-foreground">—</span>
                )}
              </button>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => shift(7)}
          aria-label="Next week"
          className="shrink-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Slots grouped by time-of-day */}
      <Card className="p-4">
        {daySlots.length === 0 ? (
          <EmptyState
            title="No available slots on this day"
            description="Try a different day this week or the following week."
          />
        ) : (
          <div className="space-y-4">
            {buckets.map(
              (b) =>
                b.slots.length > 0 && (
                  <div key={b.key}>
                    <div className="mb-2 flex items-center gap-2">
                      <b.icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {b.label}
                      </span>
                      <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                        {b.slots.length} available
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
                      {b.slots.map((s) => {
                        const label = new Date(s.start).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        });
                        return (
                          <Link
                            key={s.start}
                            href={`/book?practitionerId=${practitionerId}&start=${encodeURIComponent(
                              s.start,
                            )}&end=${encodeURIComponent(s.end)}`}
                            className="group flex h-10 items-center justify-center rounded-md border bg-card text-sm font-medium tabular-nums text-foreground press-scale hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            {label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ),
            )}
          </div>
        )}
        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          You&apos;ll pick a service and pay on the next step. Booking with {practitionerName} is confirmed instantly.
        </p>
      </Card>
    </div>
  );
}

function firstDateWithAvailability(slots: Slot[], fallback: string): string {
  for (const s of slots) if (s.available) return s.start.slice(0, 10);
  return fallback;
}

function bucketSlots(slots: Slot[]) {
  const morning: Slot[] = [];
  const afternoon: Slot[] = [];
  const evening: Slot[] = [];
  for (const s of slots) {
    const h = new Date(s.start).getHours();
    if (h < 12) morning.push(s);
    else if (h < 17) afternoon.push(s);
    else evening.push(s);
  }
  return [
    { key: 'morning', label: 'Morning', icon: Sunrise, slots: morning },
    { key: 'afternoon', label: 'Afternoon', icon: Sun, slots: afternoon },
    { key: 'evening', label: 'Evening', icon: Sunset, slots: evening },
  ];
}
