'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

  const daySlots = (byDate.get(selectedDate) ?? []).filter((s) => s.available);

  function shift(delta: number) {
    const d = new Date(from);
    d.setDate(d.getDate() + delta);
    router.push(`/doctors/${practitionerId}?date=${d.toISOString().slice(0, 10)}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => shift(-7)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-wrap gap-2">
          {days.map((d) => {
            const has = (byDate.get(d) ?? []).some((s) => s.available);
            const active = d === selectedDate;
            const date = new Date(d);
            return (
              <button
                key={d}
                onClick={() => has && setSelectedDate(d)}
                disabled={!has}
                className={cn(
                  'flex flex-col items-center rounded-md border px-3 py-2 text-xs transition-colors',
                  active && has && 'border-primary bg-primary/10 text-primary',
                  !active && has && 'hover:border-primary/40',
                  !has && 'cursor-not-allowed opacity-50',
                )}
              >
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className="text-sm font-semibold">{date.getDate()}</span>
              </button>
            );
          })}
        </div>
        <Button variant="outline" size="sm" onClick={() => shift(7)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Card className="p-4">
        {daySlots.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No available slots on this day. Try another day.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {daySlots.map((s) => {
              const t = new Date(s.start);
              const label = t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
              return (
                <Button
                  key={s.start}
                  variant="outline"
                  asChild
                  className="w-full justify-center"
                >
                  <Link
                    href={`/book?practitionerId=${practitionerId}&start=${encodeURIComponent(s.start)}&end=${encodeURIComponent(s.end)}`}
                  >
                    {label}
                  </Link>
                </Button>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          You&apos;ll pick a service and pay on the next step. {practitionerName} confirmation is instant.
        </p>
      </Card>
    </div>
  );
}

function firstDateWithAvailability(slots: Slot[], fallback: string): string {
  for (const s of slots) if (s.available) return s.start.slice(0, 10);
  return fallback;
}
