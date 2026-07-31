import { redirect } from 'next/navigation';
import { BookShell } from '@/components/domain/book-shell';
import { getBookableService, listBookableServices } from '@/lib/data/service-catalog';
import { getBranchBySlug } from '@/lib/data/reference-repo';
import { getLocale } from '@/lib/i18n-server';
import { ServiceBookingFlow } from './service-booking-flow';

export const dynamic = 'force-dynamic';

export default async function BookByServicePage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; department?: string; branch?: string; preference?: string }>;
}) {
  const { service: requestedService, department, branch, preference } = await searchParams;

  // Branch is chosen at /book before any service or doctor. Reaching this step
  // without one means the funnel was entered mid-way (a shared link, a stale
  // bookmark) — send them back to make that choice first.
  const selectedBranch = branch ? await getBranchBySlug(branch) : null;
  if (!selectedBranch || !selectedBranch.published) {
    const params = new URLSearchParams();
    if (requestedService) params.set('service', requestedService);
    if (department) params.set('department', department);
    if (preference) params.set('preference', preference);
    redirect(`/book${params.size ? `?${params}` : ''}`);
  }

  const locale = await getLocale();

  // Filtering happens in the query now. It used to intersect against the
  // hardcoded catalogue's `departmentSlug`, a field the database rows never
  // had — so in production a department chip returned zero services.
  const services = await listBookableServices({
    onlineOnly: true,
    departmentSlug: department,
  });

  // Links carry a service slug (/services/[slug], the search index, visit
  // reasons) while the flow works in ids, so resolve either form here.
  const initialService = requestedService ? await getBookableService(requestedService) : null;

  return (
    <BookShell
      backHref={`/book?branch=${selectedBranch.slug}`}
      backLabel="Change branch"
      title="What do you need?"
      description={`${locale === 'ar' ? selectedBranch.nameAr : selectedBranch.nameEn} · pick a service, then choose your time and specialist.`}
    >
      <ServiceBookingFlow
        services={services.map((s) => ({
          id: s.id,
          name: locale === 'ar' ? (s.nameAr ?? s.name) : s.name,
          durationMinutes: s.durationMinutes,
          priceMinor: s.priceMinor,
          currency: s.currency,
        }))}
        initialServiceId={initialService?.id}
        preferFirstAvailable={preference === 'first'}
        branch={selectedBranch.slug}
      />
    </BookShell>
  );
}
