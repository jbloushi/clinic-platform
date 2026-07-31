'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AvailabilityDayPicker, type AvailabilityDay } from '@/components/domain/availability-day-picker';
import { TimeSlotPicker } from '@/components/domain/time-slot-picker';
import { cn, formatPrice, formatTime } from '@/lib/utils';
import type { Slot } from '@/lib/data/types';

const WINDOW_DAYS = 7;

/**
 * Day-and-time selection for a specialist, with the sticky booking summary the
 * design puts at the bottom of the screen.
 *
 * The server loads a seven-day window; picking a day inside it is instant local
 * state, while the full-calendar input navigates to reload the window around a
 * new date. Selecting a time never commits anything — the patient still has to
 * press Continue, and the server revalidates the slot before holding it.
 */
export function SlotPicker({
  practitionerId,
  practitionerName,
  from,
  slots,
  consultationFeeMinor,
  currency,
  branchSlug,
  followUpFrom,
  serviceId,
}: {
  practitionerId: string;
  practitionerName: string;
  /** First day of the loaded window, "YYYY-MM-DD". */
  from: string;
  slots: Slot[];
  consultationFeeMinor?: number;
  currency?: string;
  /** Already-chosen branch. When absent, /book asks for one before the form. */
  branchSlug?: string;
  /** Booking this visit continues, carried through to the commit. */
  followUpFrom?: string;
  serviceId?: string;
}) {
  const router = useRouter();

  const byDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots) {
      const day = slot.start.slice(0, 10);
      const list = map.get(day) ?? [];
      list.push(slot);
      map.set(day, list);
    }
    return map;
  }, [slots]);

  const days = useMemo<AvailabilityDay[]>(() => {
    const list: AvailabilityDay[] = [];
    const start = new Date(`${from}T00:00:00`);
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const date = toDateKey(day);
      list.push({
        date,
        count: (byDate.get(date) ?? []).filter((slot) => slot.available).length,
      });
    }
    return list;
  }, [from, byDate]);

  const [selectedDate, setSelectedDate] = useState(
    () => days.find((day) => day.count > 0)?.date ?? from,
  );
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const daySlots = byDate.get(selectedDate) ?? [];
  const windowEnd = days[days.length - 1]?.date;

  /** Context that must survive both a window reload and the hop to /book. */
  const carried = new URLSearchParams();
  if (branchSlug) carried.set('branch', branchSlug);
  if (followUpFrom) carried.set('followUpFrom', followUpFrom);
  if (serviceId) carried.set('serviceId', serviceId);
  const carriedQuery = carried.size ? `&${carried}` : '';

  function chooseDate(date: string) {
    // Outside the loaded window: reload around the new date.
    if (date < from || (windowEnd && date > windowEnd)) {
      router.push(`/doctors/${practitionerId}?date=${date}${carriedQuery}#booking`);
      return;
    }
    setSelectedDate(date);
    setSelectedSlot(null);
  }

  function goToBooking() {
    if (!selectedSlot) return;
    router.push(
      `/book?practitionerId=${practitionerId}&start=${encodeURIComponent(
        selectedSlot.start,
      )}&end=${encodeURIComponent(selectedSlot.end)}${carriedQuery}`,
    );
  }

  const selectedDayLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <div>
      <h2 className="mb-2.5 text-[14.5px] font-semibold">Choose a day</h2>
      <AvailabilityDayPicker
        days={days}
        value={selectedDate}
        onSelect={chooseDate}
        min={toDateKey(new Date())}
      />

      <h2 className="mb-2.5 mt-6 text-[14.5px] font-semibold">Available times</h2>
      <TimeSlotPicker
        slots={daySlots}
        selectedStart={selectedSlot?.start}
        onSelect={setSelectedSlot}
        emptyDescription={`${practitionerName} has no open times on ${selectedDayLabel}. Try another day or pick a date from the calendar.`}
      />

      <div className="sticky-action-bar -mx-5 mt-7 flex items-center gap-3.5 px-5 pt-3.5 md:-mx-8 md:px-8">
        <div className="min-w-0 flex-1">
          {selectedSlot ? (
            <>
              <p className="text-[11px] text-muted-foreground">
                {selectedDayLabel} · {formatTime(selectedSlot.start)}
              </p>
              <p className="truncate text-[14px] font-semibold">
                {consultationFeeMinor && consultationFeeMinor > 0
                  ? formatPrice(consultationFeeMinor, currency)
                  : 'Consultation'}
              </p>
            </>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">
              Select a time to continue
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={goToBooking}
          disabled={!selectedSlot}
          className={cn(
            'press-scale flex min-h-[48px] flex-1 items-center justify-center rounded-[13px] px-5 text-[15px] font-semibold transition-colors',
            selectedSlot
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'cursor-not-allowed bg-muted text-muted-foreground',
          )}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

/** Local-date key, avoiding the UTC shift `toISOString()` introduces. */
function toDateKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
