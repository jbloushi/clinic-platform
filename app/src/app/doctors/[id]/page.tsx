import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { DoctorAvatar } from '@/components/domain/avatar';
import { PatientShell } from '@/components/domain/patient-shell';
import { getDataProvider } from '@/lib/data';
import { getEligibleServicesForSpecialist } from '@/lib/data/service-catalog';
import { getBranchBySlug, restrictToBranch } from '@/lib/data/reference-repo';
import { getLocale } from '@/lib/i18n-server';
import { formatPrice } from '@/lib/utils';
import { formatSpecialistRole } from '@/lib/specialist-meta';
import { SlotPicker } from './slot-picker';

export const dynamic = 'force-dynamic';

export default async function DoctorProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string; branch?: string; followUpFrom?: string; serviceId?: string }>;
}) {
  const { id } = await params;
  const { date, branch, followUpFrom, serviceId } = await searchParams;
  const [selectedBranch, locale] = await Promise.all([
    branch ? getBranchBySlug(branch) : Promise.resolve(null),
    getLocale(),
  ]);
  const dp = getDataProvider();
  const doctor = await dp.getPractitionerById(id);
  if (!doctor) notFound();

  const from = date ?? toDateKey(new Date());
  const windowEnd = new Date(`${from}T00:00:00`);
  windowEnd.setDate(windowEnd.getDate() + 6);
  // A doctor who doesn't work at the selected branch has nothing to offer here,
  // and showing their profile with an empty calendar reads as a fault rather
  // than a boundary. Send the patient back to the list for that branch.
  if (selectedBranch) {
    const [atBranch] = await restrictToBranch([doctor], selectedBranch.id);
    if (!atBranch) redirect(`/doctors?branch=${selectedBranch.slug}`);
  }

  const [slots, services] = await Promise.all([
    dp
      .getAvailableSlots(id, from, toDateKey(windowEnd), undefined, {
        branchId: selectedBranch?.id,
      })
      .catch(() => []),
    getEligibleServicesForSpecialist(id).catch(() => []),
  ]);

  const fullName = `${doctor.title} ${doctor.firstName} ${doctor.lastName}`.trim();
  const roleLabel = formatSpecialistRole(doctor.role);
  // "Typical visit" comes from the configured duration of the services this
  // specialist is eligible for — not an estimate.
  const typicalMinutes = shortestDuration(services.map((service) => service.durationMinutes));
  const showFee = doctor.consultationFeeMinor > 0;

  return (
    <PatientShell>
      {/* The brand hero stays, but now sits inside the site chrome rather than
          replacing it — the header carries navigation, so the hero only has to
          carry identity. */}
      <section className="brand-gradient px-5 pb-5 pt-4 text-surface-soft md:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Link
              href={selectedBranch ? `/doctors?branch=${selectedBranch.slug}` : '/doctors'}
              className="-ms-2 inline-flex min-h-9 items-center gap-1.5 rounded-control px-2 text-[13px] font-semibold hover:bg-white/10"
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
              All doctors
            </Link>
            {selectedBranch && (
              <p className="truncate text-[13px] text-surface-soft/80">
                {locale === 'ar' ? selectedBranch.nameAr : selectedBranch.nameEn}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4">
            <DoctorAvatar
              name={`${doctor.firstName} ${doctor.lastName}`}
              specialty={doctor.specialty}
              photoUrl={doctor.photoUrl}
              size={70}
              tone="on-brand"
            />
            <div className="min-w-0">
              <h1 className="font-editorial text-[20px] font-semibold leading-[1.1] md:text-[26px]">
                {fullName}
              </h1>
              <p className="mt-1 text-[13px] text-surface-soft/85">
                {[roleLabel, doctor.specialty].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {(showFee || typicalMinutes) && (
        <div className="bg-primary-dark px-5 pb-4 text-surface-soft md:px-8">
          <dl className="mx-auto flex max-w-3xl">
            {showFee && (
              <Stat
                label="Consultation"
                value={formatPrice(doctor.consultationFeeMinor, doctor.currency)}
              />
            )}
            {typicalMinutes && <Stat label="Typical visit" value={`${typicalMinutes} min`} />}
          </dl>
        </div>
      )}

      <div className="flex flex-1 flex-col px-5 pt-5 md:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
          {doctor.bio && (
            <p className="mb-5 text-[13.5px] leading-relaxed text-foreground/75">{doctor.bio}</p>
          )}

          <section id="booking" className="flex flex-1 flex-col scroll-mt-4">
            <h2 className="sr-only">Book an appointment</h2>
            <SlotPicker
              practitionerId={doctor.id}
              practitionerName={fullName}
              from={from}
              slots={slots}
              consultationFeeMinor={doctor.consultationFeeMinor}
              currency={doctor.currency}
              branchSlug={selectedBranch?.slug}
              followUpFrom={followUpFrom}
              serviceId={serviceId}
            />
          </section>
        </div>
      </div>
    </PatientShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 border-e border-white/15 px-3 text-center first:ps-0 last:border-e-0 last:pe-0">
      <dd className="font-editorial text-[17px] font-semibold tabular-nums">{value}</dd>
      <dt className="text-[11px] text-surface-soft/65">{label}</dt>
    </div>
  );
}

function shortestDuration(durations: (number | undefined)[]): number | null {
  const valid = durations.filter((d): d is number => typeof d === 'number' && d > 0);
  return valid.length > 0 ? Math.min(...valid) : null;
}

/** Local-date key, avoiding the UTC shift `toISOString()` introduces. */
function toDateKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
