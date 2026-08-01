import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, ChevronRight } from 'lucide-react';
import { BookShell } from '@/components/domain/book-shell';
import { getDataProvider } from '@/lib/data';
import { getEligibleServicesForSpecialist } from '@/lib/data/service-catalog';
import { getBranchBySlug, listBranches } from '@/lib/data/reference-repo';
import { getLocale } from '@/lib/i18n-server';
import { BookingForm } from './form';

export const dynamic = 'force-dynamic';

/**
 * Narrow "practitioner + a slot already chosen elsewhere → confirm & pay"
 * endpoint. This used to also be the general booking ENTRY POINT (branch →
 * service/doctor search), which is why it grew a `service`-without-`branch`
 * redirect into `/book/service` that could loop forever whenever a link
 * carried a service but no branch (every "Book" CTA on a service/department
 * page did exactly that). That entry-point role now belongs to `/book/v2`
 * exclusively — this route no longer has any redirect that can point back at
 * itself or at a page that redirects back here, so a loop is structurally
 * impossible: every path below is a single hop to a terminal page.
 *
 * Reached only from: `/doctors/[id]`'s in-page slot picker (practitionerId +
 * start + end, already carrying its own branch/service) and the consult
 * workspace's follow-up link (followUpFrom + practitionerId, no slot yet).
 * Anything else — including old bookmarked links from before this route was
 * narrowed — lands on `/book/v2` to start a fresh search.
 */
export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{
    practitionerId?: string;
    serviceId?: string;
    branch?: string;
    start?: string;
    end?: string;
    followUpFrom?: string;
  }>;
}) {
  const { practitionerId, serviceId, branch, start, end, followUpFrom } = await searchParams;
  const locale = await getLocale();
  const selectedBranch = branch ? await getBranchBySlug(branch) : null;
  const branchName = selectedBranch
    ? locale === 'ar'
      ? selectedBranch.nameAr
      : selectedBranch.nameEn
    : undefined;

  // A follow-up continues with the specialist who asked for it, so it goes
  // straight to their calendar rather than back through service search.
  if (followUpFrom && practitionerId && (!start || !end)) {
    const params = new URLSearchParams({ followUpFrom });
    if (serviceId) params.set('serviceId', serviceId);
    if (branch) params.set('branch', branch);
    redirect(`/doctors/${encodeURIComponent(practitionerId)}?${params}#booking`);
  }

  // Not a practitioner+slot confirmation — nothing left for this route to do.
  if (!practitionerId || !start || !end) {
    const params = new URLSearchParams();
    if (branch) params.set('branch', branch);
    redirect(`/book/v2${params.size ? `?${params}` : ''}`);
  }

  // Branch is decided before the visit is committed, not after. A slot chosen
  // from a doctor profile arrives here without one, so ask for it now rather
  // than letting the booking complete with an unknown location.
  if (!selectedBranch) {
    const currentParams = new URLSearchParams();
    if (practitionerId) currentParams.set('practitionerId', practitionerId);
    if (serviceId) currentParams.set('serviceId', serviceId);
    if (followUpFrom) currentParams.set('followUpFrom', followUpFrom);
    currentParams.set('start', start);
    currentParams.set('end', end);

    return (
      <BookShell
        backHref={`/doctors/${practitionerId}#booking`}
        backLabel="Change slot"
        title="Which branch?"
        description="Choose where you’d like to be seen. Your selected time stays the same."
      >
        <BranchPicker baseParams={currentParams.toString()} locale={locale} />
      </BookShell>
    );
  }

  const doctor = await getDataProvider().getPractitionerById(practitionerId);
  if (!doctor) redirect('/doctors');
  // Only services this specialist is eligible for (unrestricted, or explicitly linked).
  const services = await getEligibleServicesForSpecialist(practitionerId);
  const preselected = serviceId ? services.find((s) => s.id === serviceId) : undefined;
  const offered = preselected ? [preselected] : services;
  const slotHref = `/doctors/${practitionerId}?branch=${branch}#booking`;

  return (
    <BookShell
      backHref={slotHref}
      backLabel="Change slot"
      title={followUpFrom ? 'Confirm your follow-up' : 'Your details'}
    >
      <BookingForm
        practitionerId={practitionerId}
        followUpFromBookingId={followUpFrom}
        practitionerName={`${doctor.title} ${doctor.firstName} ${doctor.lastName}`.trim()}
        practitionerSpecialty={doctor.specialty}
        practitionerPhotoUrl={doctor.photoUrl}
        start={start}
        end={end}
        consultationFeeMinor={preselected?.priceMinor ?? doctor.consultationFeeMinor}
        currency={doctor.currency}
        branchName={branchName}
        branchSlug={selectedBranch.slug}
        editHref={slotHref}
        services={offered.map((s) => ({
          id: s.id,
          name: s.name,
          durationMinutes: s.durationMinutes,
          priceMinor: s.priceMinor,
        }))}
      />
    </BookShell>
  );
}

/**
 * Branch picker for a slot that already has a time but no location. Plain links
 * rather than client state — the choice is a navigation, and rendering it on the
 * server keeps this step out of the client bundle.
 */
async function BranchPicker({ baseParams, locale }: { baseParams: string; locale: 'en' | 'ar' }) {
  const branches = await listBranches({ publishedOnly: true });

  return (
    <ul className="space-y-2.5">
      {branches.map((branch) => (
        <li key={branch.id}>
          <Link
            href={`/book?${baseParams}&branch=${branch.slug}`}
            className="press-scale flex min-h-[64px] w-full items-center gap-3.5 rounded-card border bg-surface p-4 hover:border-primary"
          >
            <span
              aria-hidden
              className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-tint-teal text-primary"
            >
              <Building2 className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold">
                {locale === 'ar' ? branch.nameAr : branch.nameEn}
              </span>
              <span className="block truncate text-[12px] text-muted-foreground">
                {locale === 'ar' ? branch.areaAr : branch.areaEn}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-primary rtl:rotate-180" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
