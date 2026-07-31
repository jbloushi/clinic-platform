'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DoctorAvatar } from '@/components/domain/avatar';
import { EmptyState } from '@/components/domain/states';
import { formatCurrency, formatTime } from '@/lib/utils';
import { PractitionerSlotPicker } from '../practitioner-slot-picker';

export type DoctorServiceOpt = {
  id: string;
  departmentId: string;
  name: string;
  durationMinutes: number;
  priceMinor: number;
  currency: string;
};

export type DoctorOpt = {
  uuid: string;
  name: string;
  specialty: string;
  photoUrl: string | null;
  services: DoctorServiceOpt[];
  /** Earliest open slot across any of this doctor's offerings, for sorting/display. */
  nextAvailable?: { start: string; end: string } | null;
};

/** Doctor-path booking: pick the doctor, then their service, then a real time. */
export function DoctorFlow({
  branchSlug,
  branchId,
  doctors,
}: {
  branchSlug: string;
  branchId: string;
  doctors: DoctorOpt[];
}) {
  const [doctor, setDoctor] = useState<DoctorOpt | null>(null);
  const [service, setService] = useState<DoctorServiceOpt | null>(null);

  if (!doctor) return <DoctorPicker doctors={doctors} onSelect={setDoctor} />;
  if (!service) {
    return <ServicePicker doctor={doctor} onSelect={setService} onBack={() => setDoctor(null)} />;
  }
  return (
    <PractitionerSlotPicker
      practitionerUuid={doctor.uuid}
      practitionerName={doctor.name}
      practitionerSpecialty={doctor.specialty}
      practitionerPhotoUrl={doctor.photoUrl}
      serviceId={service.id}
      serviceName={service.name}
      departmentId={service.departmentId}
      durationMinutes={service.durationMinutes}
      priceMinor={service.priceMinor}
      currency={service.currency}
      branchId={branchId}
      branchSlug={branchSlug}
      bookingEntryPath="DOCTOR_PATH"
      onBack={() => setService(null)}
      backLabel="Change service"
    />
  );
}

function DoctorPicker({ doctors, onSelect }: { doctors: DoctorOpt[]; onSelect: (d: DoctorOpt) => void }) {
  if (doctors.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState title="No doctors available" description="No doctor is patient-selectable at this branch yet." />
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {doctors.map((d) => (
        <button
          key={d.uuid}
          type="button"
          onClick={() => onSelect(d)}
          className="press-scale flex min-h-[72px] items-center gap-3.5 rounded-card border bg-surface p-4 text-start hover:border-primary"
        >
          <DoctorAvatar name={d.name} specialty={d.specialty} photoUrl={d.photoUrl} size={46} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold">{d.name}</span>
            <span className="block truncate text-[12px] text-muted-foreground">{d.specialty}</span>
            <span className="mt-0.5 block truncate text-[11.5px] font-medium text-primary">
              {formatNextAvailable(d.nextAvailable)}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-primary rtl:rotate-180" aria-hidden />
        </button>
      ))}
    </div>
  );
}

function ServicePicker({
  doctor,
  onSelect,
  onBack,
}: {
  doctor: DoctorOpt;
  onSelect: (s: DoctorServiceOpt) => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
      >
        Change doctor
      </button>
      <div className="flex items-center gap-3.5 rounded-card border bg-surface p-4">
        <DoctorAvatar name={doctor.name} specialty={doctor.specialty} photoUrl={doctor.photoUrl} size={46} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">{doctor.name}</p>
          <p className="truncate text-[12px] text-muted-foreground">{doctor.specialty}</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {doctor.services.map((s) => (
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

function formatNextAvailable(next?: { start: string; end: string } | null): string {
  if (next === undefined) return '';
  if (next === null) return 'No availability in the next two weeks';
  const date = new Date(next.start);
  const day = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  return `Next available ${day} · ${formatTime(next.start)}`;
}
