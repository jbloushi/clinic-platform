'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DoctorAvatar } from '@/components/domain/avatar';
import { EmptyState, LoadingState } from '@/components/domain/states';
import { formatCurrency, formatTime } from '@/lib/utils';
import { PractitionerSlotPicker } from '../practitioner-slot-picker';

export type DoctorForService = {
  uuid: string;
  departmentId: string;
  name: string;
  specialty: string;
  photoUrl: string | null;
  durationMinutes: number;
  priceMinor: number;
  nextSlot: { start: string; end: string } | null;
};

type ServiceOpt = { id: string; name: string; durationMinutes: number; priceMinor: number; currency: string };

/**
 * "First available (recommended)" + "other doctors", sorted by soonest
 * availability — the doctor-transparent alternative to a blind slot grid.
 * Every card names a specific doctor, so both "book the recommended time"
 * and "see more times with Dr. X" go through `createPractitionerSelectedBookingHold`
 * (never the blind auto-assign path) — the patient always knows who they
 * booked because they always picked a named card.
 */
export function DoctorRecommendationStep({
  service,
  branchSlug,
  branchId,
  onBackToBlind,
  onChangeService,
}: {
  service: ServiceOpt;
  branchSlug: string;
  branchId: string;
  /** Renders the plain aggregated/blind flow instead — used when no offering here is patient-selectable at all. */
  onBackToBlind: () => void;
  onChangeService: () => void;
}) {
  const router = useRouter();
  const [doctors, setDoctors] = useState<DoctorForService[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [reserving, setReserving] = useState<string | null>(null);
  const [browsingDoctor, setBrowsingDoctor] = useState<DoctorForService | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDoctors(null);
    setError(null);
    const query = new URLSearchParams({ serviceId: service.id, branchId });
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
  }, [service.id, branchId]);

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
      />
    );
  }

  async function bookRecommended(doctor: DoctorForService) {
    if (!doctor.nextSlot) return;
    setReserving(doctor.uuid);
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
          start: doctor.nextSlot.start,
          end: doctor.nextSlot.end,
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
      setReserving(null);
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
        <DoctorCard
          doctor={recommended}
          service={service}
          highlight
          reserving={reserving === recommended.uuid}
          onBook={() => bookRecommended(recommended)}
          onBrowse={() => setBrowsingDoctor(recommended)}
        />
      </section>

      {rest.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Other doctors
          </h2>
          <div className="space-y-2.5">
            {rest.map((doctor) => (
              <DoctorCard
                key={doctor.uuid}
                doctor={doctor}
                service={service}
                reserving={reserving === doctor.uuid}
                onBook={() => bookRecommended(doctor)}
                onBrowse={() => setBrowsingDoctor(doctor)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DoctorCard({
  doctor,
  service,
  highlight,
  reserving,
  onBook,
  onBrowse,
}: {
  doctor: DoctorForService;
  service: ServiceOpt;
  highlight?: boolean;
  reserving: boolean;
  onBook: () => void;
  onBrowse: () => void;
}) {
  return (
    <Card className={highlight ? 'border-[1.5px] border-primary' : undefined}>
      <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <DoctorAvatar name={doctor.name} specialty={doctor.specialty} photoUrl={doctor.photoUrl} size={46} />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold">{doctor.name}</p>
            <p className="truncate text-[12px] text-muted-foreground">{doctor.specialty}</p>
            <p className="mt-0.5 truncate text-[12.5px] font-medium text-primary">
              {doctor.nextSlot ? formatNextSlot(doctor.nextSlot.start) : 'No availability in the next two weeks'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onBrowse}
            className="press-scale flex min-h-[40px] items-center justify-center rounded-control border bg-surface px-3 text-[12.5px] font-semibold hover:bg-muted"
          >
            More times
          </button>
          <button
            type="button"
            disabled={!doctor.nextSlot || reserving}
            onClick={onBook}
            className="press-scale flex min-h-[40px] items-center justify-center rounded-control bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {reserving ? 'Booking…' : `Book · ${formatCurrency(doctor.priceMinor, 'KWD')}`}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function formatNextSlot(startIso: string): string {
  const date = new Date(startIso);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const day = isToday
    ? 'Today'
    : isTomorrow
      ? 'Tomorrow'
      : date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} at ${formatTime(startIso)}`;
}
