'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DoctorAvatar } from '@/components/domain/avatar';
import { EmptyState } from '@/components/domain/states';
import { formatCurrency } from '@/lib/utils';
import { PractitionerSlotPicker } from '../practitioner-slot-picker';
import { DoctorAvailabilityCard, type PreviewSlot } from '../_shared/doctor-availability-card';

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
  nextAvailable?: PreviewSlot | null;
  /** Up to 5 quick-pick times, one per day — no service chosen yet, so these are a preview only. */
  previewSlots: PreviewSlot[];
};

/**
 * Doctor-path booking: pick the doctor (optionally tapping a previewed time
 * to carry the date forward), then their service, then a real time. Uses the
 * same card design as the department flow's doctor list — see
 * DoctorAvailabilityCard — so the two entry paths feel like one system.
 */
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
  // A service isn't known yet when a preview time is tapped (duration/price
  // depend on it), so the tap can't book directly like the department flow's
  // can — it carries the picked date forward instead, and the real slot
  // picker opens already on that date once the service step resolves it.
  const [jumpDate, setJumpDate] = useState<string | undefined>(undefined);

  if (!doctor) {
    return (
      <DoctorPicker
        doctors={doctors}
        onSelect={(d, date) => {
          setJumpDate(date);
          setDoctor(d);
        }}
      />
    );
  }
  if (!service) {
    return (
      <ServicePicker
        doctor={doctor}
        onSelect={setService}
        onBack={() => {
          setDoctor(null);
          setJumpDate(undefined);
        }}
      />
    );
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
      initialDate={jumpDate}
    />
  );
}

function DoctorPicker({
  doctors,
  onSelect,
}: {
  doctors: DoctorOpt[];
  onSelect: (d: DoctorOpt, date?: string) => void;
}) {
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
    <div className="space-y-2.5">
      {doctors.map((d) => (
        <DoctorAvailabilityCard
          key={d.uuid}
          name={d.name}
          specialty={d.specialty}
          photoUrl={d.photoUrl}
          previewSlots={d.previewSlots}
          onSlotClick={(slot) => onSelect(d, slot.start.slice(0, 10))}
          onMoreTimes={() => onSelect(d)}
          moreTimesLabel="Choose a time"
        />
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
