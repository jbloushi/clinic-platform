import { redirect } from 'next/navigation';
import { BookShell } from '@/components/domain/book-shell';
import { getBranchBySlug } from '@/lib/data/reference-repo';
import { listPractitionerOfferings } from '@/lib/data/offering-repo';
import { getLocale } from '@/lib/i18n-server';
import { ServiceFlow } from './service-flow';

export const dynamic = 'force-dynamic';

export default async function BookV2ServicePage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; service?: string }>;
}) {
  const { branch, service } = await searchParams;

  const selectedBranch = branch ? await getBranchBySlug(branch) : null;
  if (!selectedBranch || !selectedBranch.published) redirect('/book/v2');

  const locale = await getLocale();

  const offerings = await listPractitionerOfferings({
    branchId: selectedBranch.id,
    allowAutoAssignment: true,
    activeOnly: true,
    publishedOnly: true,
  });

  const seen = new Set<string>();
  const services = offerings
    .filter((offering) => {
      if (seen.has(offering.serviceId)) return false;
      seen.add(offering.serviceId);
      return true;
    })
    .map((offering) => ({
      id: offering.service.id,
      name: locale === 'ar' ? offering.service.nameAr ?? offering.service.name : offering.service.name,
      durationMinutes: offering.service.durationMinutes,
      priceMinor: offering.service.priceMinor,
      currency: offering.service.currency,
    }));

  return (
    <BookShell
      backHref={`/book/v2?branch=${selectedBranch.slug}`}
      backLabel="Change branch"
      title="What do you need?"
      description={`${locale === 'ar' ? selectedBranch.nameAr : selectedBranch.nameEn} · pick a service — we'll assign the earliest available doctor.`}
    >
      <ServiceFlow
        branchSlug={selectedBranch.slug}
        branchId={selectedBranch.id}
        services={services}
        initialServiceId={service}
      />
    </BookShell>
  );
}
