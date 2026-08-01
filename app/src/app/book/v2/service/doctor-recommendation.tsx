'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { LoadingState } from '@/components/domain/states';
import { PractitionerSlotPicker } from '../practitioner-slot-picker';
import { DoctorAvailabilityCard, type PreviewSlot } from '../_shared/doctor-availability-card';

export type DoctorForService = {
  uuid: string;
  departmentId: string;
  name: string;
  specialty: string;
  photoUrl: string | null;
  durationMinutes: number;
  priceMinor: number;
  nextSlot: PreviewSlot | null;
  /** Up to 5 quick-book times, one per day — see getAvailabilitySummary. */
  previewSlots: PreviewSlot[];
};

type ServiceOpt = { id: string; name: string; durationMinutes: number; priceMinor: number; currency: string };

/**
 * "First available (recommended)" + "other doctors", sorted by soonest
 * availability — the doctor-transparent alternative to a blind slot grid.
 * Both a quick-book tap on a previewed time and "see more times with Dr. X"
 * go through `createPractitionerSelectedBookingHold` (never the blind
 * auto-assign path) — the patient always knows who they booked because they
 * always picked a named card.
 */
export function DoctorRecommendationStep({
  service,
  branchSlug,
  branchId,
  range,
  onBackToBlind,
  onChangeService,
}: {
  service: ServiceOpt;
  branchSlug: string;
  branchId: string;
  /** Restrict the doctor list to a patient-chosen date range (department flow) instead of the standard 14-day preview window. */
  range?: { from: string; to: string };
  /** Renders the plain aggregated/blind flow instead — used when no offering here is patient-selectable at all. */
  onBackToBlind: () => void;
  onChangeService: () => void;
}) {
  const router = useRouter();
  const [doctors, setDoctors] = useState<DoctorForService[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [reservingSlot, setReservingSlot] = useState<{ uuid: string; start: string } | null>(null);
  const [browsingDoctor, setBrowsingDoctor] = useState<DoctorForService | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDoctors(null);
    setError(null);
    const query = new URLSearchParams({ serviceId: service.id, branchId });
    if (range) {
      query.set('from', range.from);
      query.set('to', range.to);
    }
    fetch(`/api/availability/doctors-for-service?${query}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((data) => {
        if (!cancelled) setDoctors(data.doctors ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load doctor availability. Please try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [service.id, branchId, range?.from, range?.to]);

  // No offering here allows a named pick — fall back to the blind,
  // auto-assign-only flow rather than showing an empty screen. Deferred to an
  // effect (not called during render) since it updates the parent's state.
  useEffect(() => {
    if (doctors !== null && doctors.length === 0) onBackToBlind();
  }, [doctors, onBackToBlind]);

  if (browsingDoctor) {
    return (
      <PractitionerSlotPicker
        practitionerUuid={browsingDoctor.uuid}
        practitionerName={browsingDoctor.name}
        practitionerSpecialty={browsingDoctor.specialty}
        practitionerPhotoUrl={browsingDoctor.photoUrl}
        serviceId={service.id}
        serviceName={service.name}
        departmentId={browsingDoctor.departmentId}
        durationMinutes={browsingDoctor.durationMinutes}
        priceMinor={browsingDoctor.priceMinor}
        branchId={branchId}
        branchSlug={branchSlug}
        bookingEntryPath="SERVICE_PATH"
        onBack={() => setBrowsingDoctor(null)}
        backLabel="Back to doctors"
        initialDate={browsingDoctor.nextSlot?.start.slice(0, 10)}
      />
    );
  }

  async function bookSlot(doctor: DoctorForService, slot: PreviewSlot) {
    setReservingSlot({ uuid: doctor.uuid, start: slot.start });
    setReserveError(null);
    try {
      const res = await fetch('/api/booking-holds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: service.id,
          departmentId: doctor.departmentId,
          branchId,
          specialistOpenemrUuid: doctor.uuid,
          start: slot.start,
          end: slot.end,
          bookingEntryPath: 'SERVICE_PATH',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReserveError(
          data.error === 'no_availability'
            ? 'That time was just taken — pick a different time below.'
            : 'We could not reserve this appointment. Please try again.',
        );
        return;
      }
      router.push(`/book/v2/details?holdId=${data.holdId}&branch=${branchSlug}`);
    } finally {
      setReservingSlot(null);
    }
  }

  if (error) {
    return (
      <p className="p-4 text-center text-sm text-red-600" role="alert">
        {error}
      </p>
    );
  }
  if (doctors === null || doctors.length === 0) return <LoadingState label="Finding available doctors…" />;

  const [recommended, ...rest] = doctors;

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onChangeService}
        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ChevronLeft className="h-4 w-4" /> Change service
      </button>

      {reserveError && (
        <p role="alert" className="rounded-control border border-[#EBCFCB] bg-[#F7E5E3] px-3 py-2.5 text-[12.5px] text-[#8A2E24]">
          {reserveError}
        </p>
      )}

      <section>
        <h2 className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-primary">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Recommended
        </h2>
        <DoctorAvailabilityCard
          name={recommended.name}
          specialty={recommended.specialty}
          photoUrl={recommended.photoUrl}
          previewSlots={recommended.previewSlots}
          priceMinor={recommended.priceMinor}
          highlight
          reservingSlotStart={reservingSlot?.uuid === recommended.uuid ? reservingSlot.start : null}
          onSlotClick={(slot) => bookSlot(recommended, slot)}
          onMoreTimes={() => setBrowsingDoctor(recommended)}
        />
      </section>

      {rest.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Other doctors
          </h2>
          <div className="space-y-2.5">
            {rest.map((doctor) => (
              <DoctorAvailabilityCard
                key={doctor.uuid}
                name={doctor.name}
                specialty={doctor.specialty}
                photoUrl={doctor.photoUrl}
                previewSlots={doctor.previewSlots}
                priceMinor={doctor.priceMinor}
                reservingSlotStart={reservingSlot?.uuid === doctor.uuid ? reservingSlot.start : null}
                onSlotClick={(slot) => bookSlot(doctor, slot)}
                onMoreTimes={() => setBrowsingDoctor(doctor)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
