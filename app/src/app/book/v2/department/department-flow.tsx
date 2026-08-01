'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Check, Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/domain/states';
import { cn, formatCurrency } from '@/lib/utils';
import { DoctorRecommendationStep } from '../service/doctor-recommendation';
import { SlotPicker, type ServiceOpt } from '../service/service-flow';

export type DepartmentOpt = {
  id: string;
  slug: string;
  name: string;
  services: ServiceOpt[];
};

type DateRange = { from: string; to: string };

/**
 * Department-path booking: pick a department, then a service, then a date
 * range, then a doctor who has an opening in it. Mirrors the service path's
 * shape (same components downstream — DoctorRecommendationStep, SlotPicker),
 * just gated by department and with a range step in between service and the
 * doctor list.
 */
export function DepartmentFlow({
  branchSlug,
  branchId,
  departments,
  initialDepartmentId,
  initialServiceId,
}: {
  branchSlug: string;
  branchId: string;
  departments: DepartmentOpt[];
  /** Deep-link preselection — arriving from a department or service page. */
  initialDepartmentId?: string;
  initialServiceId?: string;
}) {
  const [department, setDepartment] = useState<DepartmentOpt | null>(
    () => departments.find((d) => d.id === initialDepartmentId) ?? null,
  );
  const [service, setService] = useState<ServiceOpt | null>(
    () => department?.services.find((s) => s.id === initialServiceId) ?? null,
  );
  const [range, setRange] = useState<DateRange | null>(null);
  const [blind, setBlind] = useState(false);

  if (!department) {
    return <DepartmentPicker departments={departments} onSelect={setDepartment} />;
  }
  if (!service) {
    return (
      <ServicePicker
        department={department}
        onSelect={setService}
        onBack={() => setDepartment(null)}
      />
    );
  }
  if (!range) {
    return (
      <RangePicker
        service={service}
        onSelect={setRange}
        onBack={() => setService(null)}
      />
    );
  }
  if (blind) {
    return (
      <SlotPicker
        service={service}
        branchSlug={branchSlug}
        branchId={branchId}
        onChangeService={() => {
          setService(null);
          setRange(null);
          setBlind(false);
        }}
      />
    );
  }
  return (
    <DoctorRecommendationStep
      service={service}
      branchSlug={branchSlug}
      branchId={branchId}
      range={range}
      onBackToBlind={() => setBlind(true)}
      onChangeService={() => {
        setService(null);
        setRange(null);
      }}
    />
  );
}

function DepartmentPicker({
  departments,
  onSelect,
}: {
  departments: DepartmentOpt[];
  onSelect: (d: DepartmentOpt) => void;
}) {
  if (departments.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState title="No departments available" description="No department has a bookable service at this branch yet." />
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {departments.map((d) => (
        <button
          key={d.id}
          type="button"
          onClick={() => onSelect(d)}
          className="press-scale flex min-h-[64px] items-center gap-3.5 rounded-card border bg-surface p-4 text-start hover:border-primary/40"
        >
          <span
            aria-hidden
            className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-tint-teal text-primary"
          >
            <Layers className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold">{d.name}</span>
            <span className="block truncate text-[12px] text-muted-foreground">
              {d.services.length} service{d.services.length === 1 ? '' : 's'}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-primary rtl:rotate-180" aria-hidden />
        </button>
      ))}
    </div>
  );
}

function ServicePicker({
  department,
  onSelect,
  onBack,
}: {
  department: DepartmentOpt;
  onSelect: (s: ServiceOpt) => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ChevronLeft className="h-4 w-4" /> Change department
      </button>
      <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{department.name}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {department.services.map((s) => (
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
    </div>
  );
}

const RANGE_PRESETS: { key: string; label: string; days: number; offsetDays?: number }[] = [
  { key: 'this-week', label: 'This week', days: 7 },
  { key: 'next-week', label: 'Next week', days: 7, offsetDays: 7 },
  { key: 'this-month', label: 'Next 30 days', days: 30 },
];

function RangePicker({
  service,
  onSelect,
  onBack,
}: {
  service: ServiceOpt;
  onSelect: (r: DateRange) => void;
  onBack: () => void;
}) {
  const [preset, setPreset] = useState<string | 'custom'>('this-week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  function toISODate(d: Date) {
    return d.toISOString().slice(0, 10);
  }

  function continueWithRange() {
    if (preset === 'custom') {
      if (!customFrom || !customTo || customFrom > customTo) return;
      onSelect({ from: customFrom, to: customTo });
      return;
    }
    const chosen = RANGE_PRESETS.find((p) => p.key === preset)!;
    const from = new Date();
    from.setDate(from.getDate() + (chosen.offsetDays ?? 0));
    const to = new Date(from);
    to.setDate(to.getDate() + chosen.days - 1);
    onSelect({ from: toISODate(from), to: toISODate(to) });
  }

  const customInvalid = preset === 'custom' && customFrom && customTo && customFrom > customTo;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
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

      <fieldset>
        <legend className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          When would you like to be seen?
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {RANGE_PRESETS.map((p) => {
            const active = preset === p.key;
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={active}
                onClick={() => setPreset(p.key)}
                className={cn(
                  'press-scale flex min-h-[48px] items-center justify-between rounded-lg border bg-card px-4 text-sm font-medium',
                  active ? 'border-primary bg-tint-teal text-primary' : 'hover:border-primary/40',
                )}
              >
                {p.label}
                {active && <Check className="h-4 w-4" strokeWidth={3} />}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={preset === 'custom'}
            onClick={() => setPreset('custom')}
            className={cn(
              'press-scale flex min-h-[48px] items-center justify-between rounded-lg border bg-card px-4 text-sm font-medium',
              preset === 'custom' ? 'border-primary bg-tint-teal text-primary' : 'hover:border-primary/40',
            )}
          >
            Custom dates
            {preset === 'custom' && <Check className="h-4 w-4" strokeWidth={3} />}
          </button>
        </div>

        {preset === 'custom' && (
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <label className="text-xs font-medium text-muted-foreground">
              From
              <input
                type="date"
                value={customFrom}
                min={toISODate(new Date())}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="mt-1 block w-full rounded-md border bg-card px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              To
              <input
                type="date"
                value={customTo}
                min={customFrom || toISODate(new Date())}
                onChange={(e) => setCustomTo(e.target.value)}
                className="mt-1 block w-full rounded-md border bg-card px-3 py-2 text-sm"
              />
            </label>
            {customInvalid && (
              <p className="col-span-2 text-xs text-[#8A2E24]">End date must be on or after the start date.</p>
            )}
          </div>
        )}
      </fieldset>

      <button
        type="button"
        disabled={preset === 'custom' && (!customFrom || !customTo || !!customInvalid)}
        onClick={continueWithRange}
        className="press-scale flex min-h-[44px] w-full items-center justify-center rounded-control bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        See available doctors
      </button>
    </div>
  );
}
