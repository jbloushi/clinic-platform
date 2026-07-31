import { redirect } from 'next/navigation';
import { BookShell } from '@/components/domain/book-shell';
import { getBranchBySlug } from '@/lib/data/reference-repo';
import { listPractitionerOfferings } from '@/lib/data/offering-repo';
import { getDataProvider } from '@/lib/data';
import { getLocale } from '@/lib/i18n-server';
import { getNextAvailableSlot } from '@/lib/booking/next-available';
import { DoctorFlow, type DoctorOpt } from './doctor-flow';

export const dynamic = 'force-dynamic';

export default async function BookV2DoctorPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const { branch } = await searchParams;

  const selectedBranch = branch ? await getBranchBySlug(branch) : null;
  if (!selectedBranch || !selectedBranch.published) redirect('/book/v2');

  const locale = await getLocale();

  const offerings = await listPractitionerOfferings({
    branchId: selectedBranch.id,
    allowPatientChoice: true,
    activeOnly: true,
    publishedOnly: true,
  });

  const byUuid = new Map<string, typeof offerings>();
  for (const offering of offerings) {
    const arr = byUuid.get(offering.specialistOpenemrUuid) ?? [];
    arr.push(offering);
    byUuid.set(offering.specialistOpenemrUuid, arr);
  }

  const dp = getDataProvider();
  const unsorted = (
    await Promise.all(
      Array.from(byUuid.entries()).map(async ([uuid, rows]) => {
        const practitioner = await dp.getPractitionerById(uuid).catch(() => null);
        if (!practitioner || !practitioner.active) return null;
        // No service is chosen yet at this step, so this is a preview figure
        // only — sorts and reassures, but the real slot list (with the
        // service's actual duration) is fetched once one is picked.
        const nextAvailable = await getNextAvailableSlot(dp, uuid, selectedBranch.id, rows[0]?.service.durationMinutes);
        return {
          uuid,
          name: `${practitioner.title} ${practitioner.firstName} ${practitioner.lastName}`.trim(),
          specialty: practitioner.specialty,
          photoUrl: practitioner.photoUrl ?? null,
          nextAvailable,
          services: rows.map((row) => ({
            id: row.service.id,
            departmentId: row.departmentId,
            name: locale === 'ar' ? row.service.nameAr ?? row.service.name : row.service.name,
            durationMinutes: row.service.durationMinutes,
            priceMinor: row.service.priceMinor,
            currency: row.service.currency,
          })),
        } satisfies DoctorOpt;
      }),
    )
  ).filter((d): d is NonNullable<typeof d> => d !== null);

  // Earliest available first — a doctor with nothing free in the search
  // window sorts last rather than by name, which would bury real availability.
  const doctors = unsorted.sort((a, b) => {
    if (!a.nextAvailable && !b.nextAvailable) return 0;
    if (!a.nextAvailable) return 1;
    if (!b.nextAvailable) return -1;
    return a.nextAvailable.start.localeCompare(b.nextAvailable.start);
  });

  return (
    <BookShell
      backHref={`/book/v2?branch=${selectedBranch.slug}`}
      backLabel="Change branch"
      title="Choose your doctor"
      description={`${locale === 'ar' ? selectedBranch.nameAr : selectedBranch.nameEn} · select a doctor, then their available appointments.`}
    >
      <DoctorFlow branchSlug={selectedBranch.slug} branchId={selectedBranch.id} doctors={doctors} />
    </BookShell>
  );
}
