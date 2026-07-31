'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { DoctorAvatar } from '@/components/domain/avatar';
import { EmptyState, LoadingState } from '@/components/domain/states';
import { cn, formatCurrency } from '@/lib/utils';
import type { Slot } from '@/lib/data/types';

type BranchOption = { id: string; name: string };
type ServiceOption = { id: string; name: string; durationMinutes: number; priceMinor: number; currency: string };
type DoctorOption = {
  uuid: string;
  departmentId: string;
  name: string;
  specialty: string;
  photoUrl: string | null;
};

type DoctorMode = 'same' | 'auto' | 'choose';

export function ChangeFlow({
  bookingId,
  currentBranchId,
  currentServiceId,
  currentPractitionerId,
  currentServiceName,
  currentPractitionerName,
  currentBranchName,
  branches,
}: {
  bookingId: string;
  currentBranchId: string | null;
  currentServiceId: string;
  currentPractitionerId: string;
  currentServiceName: string | null;
  currentPractitionerName: string | null;
  currentBranchName: string | null;
  branches: BranchOption[];
}) {
  const router = useRouter();

  const [branchId, setBranchId] = useState(currentBranchId ?? branches[0]?.id ?? '');
  const [services, setServices] = useState<ServiceOption[] | null>(null);
  const [serviceId, setServiceId] = useState(currentServiceId);

  const [doctors, setDoctors] = useState<DoctorOption[] | null>(null);
  const [doctorMode, setDoctorMode] = useState<DoctorMode>('same');
  const [chosenDoctorUuid, setChosenDoctorUuid] = useState('');

  const [weekStart, setWeekStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedDate, setSelectedDate] = useState(weekStart);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reserving, setReserving] = useState(false);

  // Reload the service list whenever the branch changes; the previously
  // selected service may not be offered at the new branch at all.
  useEffect(() => {
    let cancelled = false;
    setServices(null);
    fetch(`/api/services/for-branch?branchId=${branchId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((data) => {
        if (cancelled) return;
        const list: ServiceOption[] = data.services ?? [];
        setServices(list);
        if (!list.some((s) => s.id === serviceId)) setServiceId(list[0]?.id ?? '');
      })
      .catch(() => {
        if (!cancelled) setServices([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  // Reload the doctor list whenever branch or service changes.
  useEffect(() => {
    if (!serviceId) {
      setDoctors([]);
      return;
    }
    let cancelled = false;
    setDoctors(null);
    fetch(`/api/availability/doctors-for-service?serviceId=${serviceId}&branchId=${branchId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((data) => {
        if (!cancelled) setDoctors(data.doctors ?? []);
      })
      .catch(() => {
        if (!cancelled) setDoctors([]);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId, branchId]);

  const currentDoctorStillOffersThis = doctors?.some((d) => d.uuid === currentPractitionerId) ?? false;
  useEffect(() => {
    if (doctors !== null && doctorMode === 'same' && !currentDoctorStillOffersThis) {
      setDoctorMode('auto');
    }
  }, [doctors, doctorMode, currentDoctorStillOffersThis]);

  const service = services?.find((s) => s.id === serviceId) ?? null;
  const targetDoctorUuid =
    doctorMode === 'same' ? currentPractitionerId : doctorMode === 'choose' ? chosenDoctorUuid : null;
  const targetDoctor = doctors?.find((d) => d.uuid === targetDoctorUuid) ?? null;

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

  // Load slots once a service and (if a doctor is required) a doctor are settled.
  useEffect(() => {
    if (!service || !branchId) {
      setSlots(null);
      return;
    }
    if (doctorMode !== 'auto' && !targetDoctorUuid) {
      setSlots(null);
      return;
    }
    let cancelled = false;
    setSlots(null);
    setLoadError(null);
    const to = new Date(weekStart);
    to.setDate(to.getDate() + 6);
    const toStr = to.toISOString().slice(0, 10);

    const url =
      doctorMode === 'auto'
        ? `/api/availability/bulk?serviceId=${serviceId}&branchId=${branchId}&from=${weekStart}&to=${toStr}`
        : `/api/availability/practitioner?practitionerId=${targetDoctorUuid}&branchId=${branchId}&from=${weekStart}&to=${toStr}&durationMinutes=${service.durationMinutes}`;

    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((data) => {
        if (!cancelled) setSlots((data.slots ?? []).filter((s: Slot) => s.available));
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load availability. Please try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [service, branchId, serviceId, doctorMode, targetDoctorUuid, weekStart]);

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

  function shift(deltaDays: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + deltaDays);
    const next = d.toISOString().slice(0, 10);
    setWeekStart(next);
    setSelectedDate(next);
  }

  async function reserve(slot: Slot) {
    setReserving(true);
    setSubmitError(null);
    try {
      const body: Record<string, unknown> = {
        start: slot.start,
        end: slot.end,
        branchId,
        serviceId,
      };
      if (doctorMode === 'auto') {
        body.specialistOpenemrUuid = null;
      } else if (targetDoctor) {
        body.specialistOpenemrUuid = targetDoctor.uuid;
        body.departmentId = targetDoctor.departmentId;
      }

      const res = await fetch(`/api/booking-holds/${bookingId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(
          data.error === 'no_availability'
            ? 'That time was just taken. Your original appointment is unchanged — pick another.'
            : data.error === 'no_op'
              ? 'That matches your current appointment already.'
              : 'We could not move this appointment. Your original one is unchanged.',
        );
        return;
      }
      if (data.paymentRequired) {
        router.push(`/book/v2/review?holdId=${data.holdId}`);
      } else {
        router.push(`/book/confirmed?id=${data.holdId}`);
      }
      router.refresh();
    } finally {
      setReserving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-5 text-[13px] text-muted-foreground">
          Currently <span className="font-semibold text-foreground">{currentServiceName ?? 'this service'}</span>{' '}
          with <span className="font-semibold text-foreground">{currentPractitionerName ?? 'your specialist'}</span>{' '}
          at <span className="font-semibold text-foreground">{currentBranchName ?? 'the clinic'}</span>.
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="rc-branch">Branch</Label>
          <select
            id="rc-branch"
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rc-service">Service</Label>
          <select
            id="rc-service"
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            disabled={services === null}
          >
            {services === null && <option>Loading…</option>}
            {services?.length === 0 && <option value="">No services at this branch</option>}
            {services?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {formatCurrency(s.priceMinor, s.currency)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Doctor</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          <DoctorModeOption
            label="Same doctor"
            active={doctorMode === 'same'}
            disabled={doctors !== null && !currentDoctorStillOffersThis}
            onSelect={() => setDoctorMode('same')}
          />
          <DoctorModeOption
            label="Let the clinic choose"
            active={doctorMode === 'auto'}
            onSelect={() => setDoctorMode('auto')}
          />
          <DoctorModeOption
            label="Choose a doctor"
            active={doctorMode === 'choose'}
            onSelect={() => setDoctorMode('choose')}
          />
        </div>
        {doctorMode === 'choose' && (
          <div className="grid gap-2 pt-1 sm:grid-cols-2">
            {doctors === null ? (
              <LoadingState label="Finding doctors…" />
            ) : doctors.length === 0 ? (
              <p className="text-xs text-muted-foreground">No doctor is patient-selectable for this service here.</p>
            ) : (
              doctors.map((d) => (
                <button
                  key={d.uuid}
                  type="button"
                  onClick={() => setChosenDoctorUuid(d.uuid)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md border p-2.5 text-left press-scale',
                    chosenDoctorUuid === d.uuid ? 'border-[1.5px] border-primary' : 'hover:bg-muted',
                  )}
                >
                  <DoctorAvatar name={d.name} specialty={d.specialty} photoUrl={d.photoUrl} size={34} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{d.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{d.specialty}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

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
                {isToday && <span className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-primary">Today</span>}
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

      {submitError && (
        <p role="alert" className="rounded-control border border-[#EBCFCB] bg-[#F7E5E3] px-3 py-2.5 text-[12.5px] text-[#8A2E24]">
          {submitError}
        </p>
      )}

      <Card className="p-4">
        {loadError ? (
          <p className="p-4 text-center text-sm text-red-600" role="alert">
            {loadError}
          </p>
        ) : doctorMode !== 'auto' && !targetDoctorUuid ? (
          <EmptyState title="Choose a doctor" description="Pick a doctor above to see their available times." />
        ) : slots === null ? (
          <LoadingState label="Finding available times…" />
        ) : daySlots.length === 0 ? (
          <EmptyState title="No available slots on this day" description="Try a different day this week or the following week." />
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

function DoctorModeOption({
  label,
  active,
  disabled,
  onSelect,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'rounded-md border p-2.5 text-center text-[12.5px] font-medium press-scale',
        disabled ? 'cursor-not-allowed opacity-40' : active ? 'border-[1.5px] border-primary bg-primary/5' : 'hover:bg-muted',
      )}
    >
      {label}
    </button>
  );
}
