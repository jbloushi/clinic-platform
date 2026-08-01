import { redirect } from 'next/navigation';
import { BookShell } from '@/components/domain/book-shell';
import { getBranchBySlug } from '@/lib/data/reference-repo';
import { listDepartments } from '@/lib/data/reference-repo';
import { listPractitionerOfferings } from '@/lib/data/offering-repo';
import { getLocale } from '@/lib/i18n-server';
import { DepartmentFlow } from './department-flow';

export const dynamic = 'force-dynamic';

export default async function BookV2DepartmentPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; department?: string; service?: string }>;
}) {
  const { branch, department: departmentSlug, service: serviceSlug } = await searchParams;

  const selectedBranch = branch ? await getBranchBySlug(branch) : null;
  if (!selectedBranch || !selectedBranch.published) redirect('/book/v2');

  const locale = await getLocale();

  const [departments, offerings] = await Promise.all([
    listDepartments({ publishedOnly: true }),
    listPractitionerOfferings({
      branchId: selectedBranch.id,
      allowAutoAssignment: true,
      activeOnly: true,
      publishedOnly: true,
    }),
  ]);

  // Services grouped by department — a service can legitimately appear under
  // more than one department if different offerings link it to each, so this
  // dedupes only WITHIN a department, not globally (unlike the flat service
  // list the old /book/v2/service page builds).
  const servicesByDepartment = new Map<
    string,
    { id: string; slug: string; name: string; durationMinutes: number; priceMinor: number; currency: string }[]
  >();
  for (const offering of offerings) {
    const list = servicesByDepartment.get(offering.departmentId) ?? [];
    if (!list.some((s) => s.id === offering.serviceId)) {
      list.push({
        id: offering.service.id,
        slug: offering.service.slug,
        name: locale === 'ar' ? offering.service.nameAr ?? offering.service.name : offering.service.name,
        durationMinutes: offering.service.durationMinutes,
        priceMinor: offering.service.priceMinor,
        currency: offering.service.currency,
      });
    }
    servicesByDepartment.set(offering.departmentId, list);
  }

  const departmentOptions = departments
    .filter((d) => (servicesByDepartment.get(d.id) ?? []).length > 0)
    .map((d) => ({
      id: d.id,
      slug: d.slug,
      name: locale === 'ar' ? d.nameAr : d.nameEn,
      services: servicesByDepartment.get(d.id) ?? [],
    }));

  // Deep-link preselection (e.g. arriving from a service or department page):
  // resolve the requested department/service slug into ids the client
  // component can pre-select. A service link on its own also resolves the
  // department that offers it, so "Book this service" skips straight past
  // the department step.
  const departmentFromService = serviceSlug
    ? departmentOptions.find((d) => d.services.some((s) => s.slug === serviceSlug))
    : undefined;
  const initialDepartmentId = departmentFromService?.id ?? departmentOptions.find((d) => d.slug === departmentSlug)?.id;
  const initialServiceId = serviceSlug
    ? departmentFromService?.services.find((s) => s.slug === serviceSlug)?.id
    : undefined;

  return (
    <BookShell
      backHref={`/book/v2?branch=${selectedBranch.slug}`}
      backLabel="Change branch"
      title="What do you need?"
      description={`${locale === 'ar' ? selectedBranch.nameAr : selectedBranch.nameEn} · pick a department, then a service.`}
    >
      <DepartmentFlow
        branchSlug={selectedBranch.slug}
        branchId={selectedBranch.id}
        departments={departmentOptions}
        initialDepartmentId={initialDepartmentId}
        initialServiceId={initialServiceId}
      />
    </BookShell>
  );
}
