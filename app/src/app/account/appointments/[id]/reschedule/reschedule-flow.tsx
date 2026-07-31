'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AvailabilityDayPicker, type AvailabilityDay } from '@/components/domain/availability-day-picker';
import { TimeSlotPicker } from '@/components/domain/time-slot-picker';
import { cn, formatTime } from '@/lib/utils';
import type { Slot } from '@/lib/data/types';

/**
 * Pick a replacement time for an existing booking.
 *
 * Reuses the same day/slot pickers as a first booking so the interaction is one
 * the patient has already learned. Confirming is a single request the server
 * treats atomically: if the new time is lost to someone else in between, the
 * original booking is restored and the patient is told, rather than being left
 * with no appointment at all.
 */
export function RescheduleFlow({
  bookingId,
  doctorName,
  serviceName,
  slots,
  currentStart,
}: {
  bookingId: string;
  doctorName: string;
  serviceName?: string;
  slots: Slot[];
  currentStart: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots) {
      // The time they already hold isn't a move — leave it out so it can't be
      // "rescheduled" onto itself.
      if (slot.start === currentStart) continue;
      const day = slot.start.slice(0, 10);
      const list = map.get(day) ?? [];
      list.push(slot);
      map.set(day, list);
    }
    return map;
  }, [slots, currentStart]);

  const days = useMemo<AvailabilityDay[]>(
    () =>
      Array.from(byDate.entries())
        .map(([date, list]) => ({ date, count: list.filter((s) => s.available).length }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [byDate],
  );

  const [selectedDate, setSelectedDate] = useState(() => days.find((d) => d.count > 0)?.date ?? '');
  const daySlots = byDate.get(selectedDate) ?? [];

  async function confirm() {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reschedule', start: selected.start, end: selected.end }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error === 'slot_conflict'
            ? 'That time was just taken. Your original appointment is unchanged — please pick another.'
            : 'We could not move this appointment. Your original time is unchanged.',
        );
        setSelected(null);
        router.refresh();
        return;
      }
      router.push('/account/appointments');
      router.refresh();
    } catch {
      setError('We could not reach the clinic. Your original time is unchanged.');
    } finally {
      setBusy(false);
    }
  }

  if (days.length === 0) {
    return (
      <div className="space-y-3">
        <p className="rounded-card border bg-surface p-5 text-[13.5px] leading-relaxed text-muted-foreground">
          {doctorName} has no other open times in the next two weeks.
        </p>
        <Link
          href={`/account/appointments/${bookingId}/reschedule/change`}
          className="block rounded-card border border-dashed border-primary/40 bg-tint-teal/40 p-4 text-center text-[13px] font-medium text-primary press-scale hover:border-primary"
        >
          Try a different doctor, service, or branch →
        </Link>
      </div>
    );
  }

  const selectedDayLabel = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : '';

  return (
    <div>
      <h2 className="mb-2.5 text-[14.5px] font-semibold">Choose a day</h2>
      <AvailabilityDayPicker
        days={days}
        value={selectedDate}
        onSelect={(date) => {
          setSelectedDate(date);
          setSelected(null);
        }}
      />

      <Link
        href={`/account/appointments/${bookingId}/reschedule/change`}
        className="mt-4 block text-[12.5px] font-medium text-primary hover:underline"
      >
        Want a different doctor, service, or branch instead? →
      </Link>

      <h2 className="mb-2.5 mt-6 text-[14.5px] font-semibold">Available times</h2>
      <TimeSlotPicker
        slots={daySlots}
        selectedStart={selected?.start}
        onSelect={setSelected}
        emptyDescription={`${doctorName} has no open times on ${selectedDayLabel}.`}
      />

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-control border border-[#EBCFCB] bg-[#F7E5E3] px-3 py-2.5 text-[12.5px] text-[#8A2E24]"
        >
          {error}
        </p>
      )}

      <div className="sticky-action-bar -mx-5 mt-7 flex items-center gap-3.5 px-5 pt-3.5 md:-mx-8 md:px-8">
        <div className="min-w-0 flex-1">
          {selected ? (
            <>
              <p className="text-[11px] text-muted-foreground">New time</p>
              <p className="truncate text-[14px] font-semibold">
                {selectedDayLabel} · {formatTime(selected.start)}
              </p>
            </>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">
              {serviceName ? `${serviceName} · ` : ''}Select a time to continue
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={confirm}
          disabled={!selected || busy}
          className={cn(
            'press-scale flex min-h-[48px] flex-1 items-center justify-center rounded-[13px] px-5 text-[15px] font-semibold transition-colors',
            selected && !busy
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'cursor-not-allowed bg-muted text-muted-foreground',
          )}
        >
          {busy ? 'Moving…' : 'Confirm new time'}
        </button>
      </div>
    </div>
  );
}
