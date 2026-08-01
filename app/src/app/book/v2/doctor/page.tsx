import { redirect } from 'next/navigation';
import { BookShell } from '@/components/domain/book-shell';
import { getBranchBySlug } from '@/lib/data/reference-repo';
import { listPractitionerOfferings } from '@/lib/data/offering-repo';
import { PRIORITY_TIER_ORDER } from '@/lib/data/offering-resolution';
import { getDataProvider } from '@/lib/data';
import { getLocale } from '@/lib/i18n-server';
import { getAvailabilitySummary } from '@/lib/booking/next-available';
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
        // only — sorts, reassures, and offers quick-pick times, but the real
        // slot list (with the service's actual duration) is fetched once a
        // service is picked.
        const { nextSlot: nextAvailable, previewSlots } = await getAvailabilitySummary(
          dp,
          uuid,
          selectedBranch.id,
          rows[0]?.service.durationMinutes,
        );
        // A doctor can have several offerings (one per service) at this
        // branch, each with its own priority — use their best (lowest) one
        // as the tiebreaker signal, same idea as auto-assignment ranking.
        const bestOffering = rows.reduce((best, row) =>
          PRIORITY_TIER_ORDER[row.assignmentPriorityTier] < PRIORITY_TIER_ORDER[best.assignmentPriorityTier] ||
          (PRIORITY_TIER_ORDER[row.assignmentPriorityTier] === PRIORITY_TIER_ORDER[best.assignmentPriorityTier] &&
            row.assignmentPriority < best.assignmentPriority)
            ? row
            : best,
        );
        return {
          uuid,
          name: `${practitioner.title} ${practitioner.firstName} ${practitioner.lastName}`.trim(),
          specialty: practitioner.specialty,
          photoUrl: practitioner.photoUrl ?? null,
          nextAvailable,
          previewSlots,
          assignmentPriorityTier: bestOffering.assignmentPriorityTier,
          assignmentPriority: bestOffering.assignmentPriority,
          services: rows.map((row) => ({
            id: row.service.id,
            departmentId: row.departmentId,
            name: locale === 'ar' ? row.service.nameAr ?? row.service.name : row.service.name,
            durationMinutes: row.service.durationMinutes,
            priceMinor: row.service.priceMinor,
            currency: row.service.currency,
          })),
        };
      }),
    )
  ).filter((d): d is NonNullable<typeof d> => d !== null);

  // Earliest available first, but doctors whose next slot falls on the same
  // calendar day are then ordered by the clinic's priority tier before exact
  // time — a doctor with nothing free in the search window sorts last rather
  // than by name, which would bury real availability.
  const doctors: DoctorOpt[] = unsorted
    .sort((a, b) => {
      if (!a.nextAvailable && !b.nextAvailable) return 0;
      if (!a.nextAvailable) return 1;
      if (!b.nextAvailable) return -1;

      const dayA = a.nextAvailable.start.slice(0, 10);
      const dayB = b.nextAvailable.start.slice(0, 10);
      if (dayA !== dayB) return dayA.localeCompare(dayB);

      const tier = PRIORITY_TIER_ORDER[a.assignmentPriorityTier] - PRIORITY_TIER_ORDER[b.assignmentPriorityTier];
      if (tier !== 0) return tier;
      if (a.assignmentPriority !== b.assignmentPriority) return a.assignmentPriority - b.assignmentPriority;

      return a.nextAvailable.start.localeCompare(b.nextAvailable.start);
    })
    .map(({ assignmentPriorityTier: _t, assignmentPriority: _p, ...doctor }) => doctor);

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
