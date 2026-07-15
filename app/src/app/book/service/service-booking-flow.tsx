'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Sun, Sunrise, Sunset } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, LoadingState } from '@/components/domain/states';
import { cn, formatCurrency } from '@/lib/utils';
import type { Slot } from '@/lib/data/types';

type ServiceOpt = { id: string; name: string; durationMinutes: number; priceMinor: number; currency: string };

/**
 * Two-step booking flow: pick a service, then pick a time from the union of
 * every eligible specialist's availability. The specialist is never shown or
 * chosen here — /api/services/[id]/slots strips practitionerId, and the
 * actual assignment happens server-side at commit (/api/bookings).
 */
export function ServiceBookingFlow({ services }: { services: ServiceOpt[] }) {
  const [selectedService, setSelectedService] = useState<ServiceOpt | null>(null);

  if (!selectedService) {
    return <ServicePicker services={services} onSelect={setSelectedService} />;
  }
  return <AggregatedSlotPicker service={selectedService} onChangeService={() => setSelectedService(null)} />;
}

function ServicePicker({
  services,
  onSelect,
}: {
  services: ServiceOpt[];
  onSelect: (s: ServiceOpt) => void;
}) {
  if (services.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState title="No services available" description="Check back soon, or browse specialists directly." />
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {services.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s)}
          className="flex min-h-[44px] items-center justify-between rounded-lg border bg-card p-4 text-left transition-all press-scale hover:border-primary/40 hover:shadow-sm"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold">{s.name}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{s.durationMinutes} min</p>
          </div>
          <p className="ml-3 shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(s.priceMinor, s.currency)}</p>
        </button>
      ))}
    </div>
  );
}

function AggregatedSlotPicker({
  service,
  onChangeService,
}: {
  service: ServiceOpt;
  onChangeService: () => void;
}) {
  const [weekStart, setWeekStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedDate, setSelectedDate] = useState(weekStart);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    fetch(`/api/services/${service.id}/slots?from=${weekStart}&to=${to.toISOString().slice(0, 10)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((data) => {
        if (!cancelled) setSlots(data.slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load availability. Please try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [service.id, weekStart]);

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
  const daySlots = byDate.get(selectedDate) ?? [];
  const buckets = useMemo(() => bucketSlots(daySlots), [daySlots]);

  function shift(deltaDays: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + deltaDays);
    const next = d.toISOString().slice(0, 10);
    setWeekStart(next);
    setSelectedDate(next);
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onChangeService}
        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ChevronLeft className="h-4 w-4" /> Change service
      </button>

      <Card>
        <CardContent className="flex items-center justify-between gap-3 pt-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{service.name}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{service.durationMinutes} min</p>
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums">
            {formatCurrency(service.priceMinor, service.currency)}
          </p>
        </CardContent>
      </Card>

      {/* Day strip */}
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
                        const label = new Date(s.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                        return (
                          <Link
                            key={s.start}
                            href={`/book?serviceId=${service.id}&start=${encodeURIComponent(s.start)}&end=${encodeURIComponent(s.end)}`}
                            className="flex h-10 items-center justify-center rounded-md border bg-card text-sm font-medium tabular-nums text-foreground press-scale hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
          We&apos;ll assign the best available specialist for this time when you confirm.
        </p>
      </Card>
    </div>
  );
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
