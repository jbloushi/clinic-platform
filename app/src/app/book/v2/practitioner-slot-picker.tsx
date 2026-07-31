'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DoctorAvatar } from '@/components/domain/avatar';
import { EmptyState, LoadingState } from '@/components/domain/states';
import { cn, formatCurrency } from '@/lib/utils';
import type { Slot } from '@/lib/data/types';
import type { BookingEntryPath } from '@/lib/booking/selection';

/**
 * Day-and-time picker for one already-chosen doctor, reserving a real
 * `BookingHold` on selection. Shared between the doctor-path (pick doctor →
 * this) and the service-path's "choose another time with this doctor"
 * drill-in from the recommended-doctor list — both name a specific doctor
 * before reserving, so both go through `createPractitionerSelectedBookingHold`
 * (`specialistOpenemrUuid` set), never the blind auto-assign path.
 */
export function PractitionerSlotPicker({
  practitionerUuid,
  practitionerName,
  practitionerSpecialty,
  practitionerPhotoUrl,
  serviceId,
  serviceName,
  departmentId,
  durationMinutes,
  priceMinor,
  currency = 'KWD',
  branchId,
  branchSlug,
  bookingEntryPath,
  onBack,
  backLabel = 'Change service',
}: {
  practitionerUuid: string;
  practitionerName: string;
  practitionerSpecialty: string;
  practitionerPhotoUrl: string | null;
  serviceId: string;
  serviceName: string;
  departmentId: string;
  durationMinutes: number;
  priceMinor: number;
  currency?: string;
  branchId: string;
  branchSlug: string;
  bookingEntryPath: BookingEntryPath;
  onBack: () => void;
  backLabel?: string;
}) {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedDate, setSelectedDate] = useState(weekStart);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [reserving, setReserving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const days = useMemo(() => {
    const list: string[] = [];
    const start = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      list.push(d.toISOString().slice(0, 10));
    }
    return list;
  }, [weekStart]);

  useEffect(() => {
    let cancelled = false;
    setSlots(null);
    setError(null);
    const to = new Date(weekStart);
    to.setDate(to.getDate() + 6);
    const query = new URLSearchParams({
      practitionerId: practitionerUuid,
      branchId,
      from: weekStart,
      to: to.toISOString().slice(0, 10),
      durationMinutes: String(durationMinutes),
    });
    fetch(`/api/availability/practitioner?${query}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((data) => {
        if (!cancelled) setSlots((data.slots ?? []).filter((s: Slot) => s.available));
      })
      .catch(() => {
        if (!cancelled) setError('Could not load availability. Please try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [practitionerUuid, branchId, durationMinutes, weekStart, refreshKey]);

  const byDate = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots ?? []) {
      const d = s.start.slice(0, 10);
      const arr = m.get(d) ?? [];
      arr.push(s);
      m.set(d, arr);
    }
    return m;
  }, [slots]);

  const today = new Date().toISOString().slice(0, 10);
  const daySlots = useMemo(() => byDate.get(selectedDate) ?? [], [byDate, selectedDate]);

  function shift(deltaDays: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + deltaDays);
    const next = d.toISOString().slice(0, 10);
    setWeekStart(next);
    setSelectedDate(next);
  }

  async function reserve(slot: Slot) {
    setReserving(true);
    setReserveError(null);
    try {
      const res = await fetch('/api/booking-holds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          departmentId,
          branchId,
          specialistOpenemrUuid: practitionerUuid,
          start: slot.start,
          end: slot.end,
          bookingEntryPath,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReserveError(
          data.error === 'no_availability'
            ? 'This time was just taken. Pick another time below.'
            : 'We could not reserve this slot. Please try again.',
        );
        setRefreshKey((k) => k + 1);
        return;
      }
      router.push(`/book/v2/details?holdId=${data.holdId}&branch=${branchSlug}`);
    } finally {
      setReserving(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ChevronLeft className="h-4 w-4" /> {backLabel}
      </button>

      <Card>
        <CardContent className="flex items-center gap-3.5 pt-5">
          <DoctorAvatar name={practitionerName} specialty={practitionerSpecialty} photoUrl={practitionerPhotoUrl} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{practitionerName}</p>
            <p className="truncate text-xs text-muted-foreground">{serviceName}</p>
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(priceMinor, currency)}</p>
        </CardContent>
      </Card>

      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => shift(-7)}
          aria-label="Previous week"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border press-scale hover:bg-accent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="grid flex-1 grid-cols-7 gap-1.5">
          {days.map((d) => {
            const count = (byDate.get(d) ?? []).length;
            const active = d === selectedDate;
            const isToday = d === today;
            const date = new Date(d);
            const disabled = slots !== null && count === 0;
            return (
              <button
                key={d}
                type="button"
                onClick={() => !disabled && setSelectedDate(d)}
                disabled={disabled}
                aria-pressed={active}
                className={cn(
                  'flex flex-col items-center rounded-lg border px-2 py-2.5 text-center transition-all',
                  active && !disabled && 'border-primary bg-primary/10 text-primary shadow-sm',
                  !active && !disabled && 'hover:border-primary/40 hover:bg-accent',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className="mt-0.5 text-lg font-semibold leading-none tabular-nums">{date.getDate()}</span>
                {isToday && (
                  <span className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-primary">Today</span>
                )}
                {!isToday && slots !== null && (
                  <span className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                    {count > 0 ? `${count} slots` : '—'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => shift(7)}
          aria-label="Next week"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border press-scale hover:bg-accent"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {reserveError && (
        <p role="alert" className="rounded-control border border-[#EBCFCB] bg-[#F7E5E3] px-3 py-2.5 text-[12.5px] text-[#8A2E24]">
          {reserveError}
        </p>
      )}

      <Card className="p-4">
        {error ? (
          <p className="p-4 text-center text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : slots === null ? (
          <LoadingState label="Finding available times…" />
        ) : daySlots.length === 0 ? (
          <EmptyState
            title="No available slots on this day"
            description="Try a different day this week or the following week."
          />
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
            {daySlots.map((s) => {
              const label = new Date(s.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
              return (
                <button
                  key={s.start}
                  type="button"
                  disabled={reserving}
                  onClick={() => reserve(s)}
                  className="flex h-10 items-center justify-center rounded-md border bg-card text-sm font-medium tabular-nums text-foreground press-scale hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-sm disabled:opacity-60"
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
