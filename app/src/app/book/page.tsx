import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, ChevronRight } from 'lucide-react';
import { BookShell } from '@/components/domain/book-shell';
import { getDataProvider } from '@/lib/data';
import { getBookableService, getEligibleServicesForSpecialist } from '@/lib/data/service-catalog';
import { getBranchBySlug, listBranches, listDepartments } from '@/lib/data/reference-repo';
import { getLocale } from '@/lib/i18n-server';
import { bookingJourneyV2Enabled } from '@/lib/env';
import { BookingForm } from './form';
import { BookingEntry } from './booking-entry';

export const dynamic = 'force-dynamic';

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{
    practitionerId?: string;
    serviceId?: string;
    service?: string;
    department?: string;
    branch?: string;
    start?: string;
    end?: string;
    followUpFrom?: string;
  }>;
}) {
  const { practitionerId, serviceId, service, department, branch, start, end, followUpFrom } =
    await searchParams;
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

  if ((!start || !end) && (serviceId || service)) {
    redirect(
      `/book/service?service=${encodeURIComponent(serviceId ?? service ?? '')}${
        department ? `&department=${encodeURIComponent(department)}` : ''
      }${branch ? `&branch=${encodeURIComponent(branch)}` : ''}`,
    );
  }

  if (!start || !end || (!practitionerId && !serviceId)) {
    const [entryBranches, entryDepartments] = await Promise.all([
      listBranches({ publishedOnly: true }),
      listDepartments({ publishedOnly: true }),
    ]);

    return (
      <BookShell
        backHref="/"
        title="Let’s find the right appointment"
        description="Start with a service, department, doctor, or the earliest suitable time."
      >
        <BookingEntry
          branches={entryBranches.map((item) => ({
            slug: item.slug,
            name: locale === 'ar' ? item.nameAr : item.nameEn,
            area: locale === 'ar' ? item.areaAr : item.areaEn,
          }))}
          departments={entryDepartments.map((item) => ({
            slug: item.slug,
            name: locale === 'ar' ? item.nameAr : item.nameEn,
          }))}
          initialDepartment={department}
          initialBranch={branch}
          v2Enabled={bookingJourneyV2Enabled}
        />
      </BookShell>
    );
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
        backHref={practitionerId ? `/doctors/${practitionerId}#booking` : '/book/service'}
        backLabel="Change slot"
        title="Which branch?"
        description="Choose where you’d like to be seen. Your selected time stays the same."
      >
        <BranchPicker baseParams={currentParams.toString()} locale={locale} />
      </BookShell>
    );
  }

  if (practitionerId) {
    const doctor = await getDataProvider().getPractitionerById(practitionerId);
    if (!doctor) redirect('/doctors');
    // Only services this specialist is eligible for (unrestricted, or explicitly
    // linked). Doctor-only services surface here for eligible docs even though
    // they're hidden from /book/service.
    const services = await getEligibleServicesForSpecialist(practitionerId);

    // Arriving from /book/service the patient already chose the service before
    // the doctor, so lock the form to it instead of reopening the choice.
    const preselected = serviceId ? services.find((s) => s.id === serviceId) : undefined;
    const offered = preselected ? [preselected] : services;
    // Same origin, so "change slot" returns to where the slot was actually picked.
    const slotHref = serviceId
      ? `/book/service?service=${encodeURIComponent(serviceId)}&branch=${branch}`
      : `/doctors/${practitionerId}?branch=${branch}#booking`;

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

  // Service-first flow — no practitionerId yet; auto-assigned at commit time.
  // Only reached from /book/service, so a doctor-only service (hidden from
  // search) shouldn't be bookable here either.
  const selectedService = await getBookableService(serviceId!);
  if (!selectedService || !selectedService.active || !selectedService.showInServiceSearch) {
    redirect('/book/service');
  }

  const serviceSlotHref = `/book/service?service=${encodeURIComponent(selectedService.id)}&branch=${branch}`;

  return (
    <BookShell backHref={serviceSlotHref} backLabel="Change slot" title="Your details">
      <BookingForm
        start={start}
        end={end}
        consultationFeeMinor={selectedService.priceMinor}
        currency={selectedService.currency}
        branchName={branchName}
        editHref={serviceSlotHref}
        services={[
          {
            id: selectedService.id,
            name: selectedService.name,
            durationMinutes: selectedService.durationMinutes,
            priceMinor: selectedService.priceMinor,
          },
        ]}
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
