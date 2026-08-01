import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/data';
import { listPractitionerOfferings, getEffectiveOfferingConfiguration } from '@/lib/data/offering-repo';
import { PRIORITY_TIER_ORDER } from '@/lib/data/offering-resolution';
import { getAvailabilitySummary } from '@/lib/booking/next-available';

/**
 * Per-doctor earliest availability for a service at a branch, sorted soonest
 * first — backs the service-path "recommended doctor + other doctors" list,
 * and the department flow's date-range-scoped doctor list.
 * Only offerings a patient may actually pick by name (`allowPatientChoice`)
 * are listed: nothing here is choosable through this endpoint that couldn't
 * also be booked by tapping its card.
 *
 * `from`/`to` are optional: omitted, this searches the standard 14-day
 * preview window (service path). When given (department path, after the
 * patient picks a date range), only that range is searched, and a doctor
 * with nothing in it is dropped entirely rather than shown as unavailable —
 * the patient already committed to that range.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get('serviceId');
  const branchId = searchParams.get('branchId');
  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;
  if (!serviceId || !branchId) {
    return NextResponse.json({ error: 'serviceId and branchId are required' }, { status: 400 });
  }
  const range = from && to ? { from, to } : undefined;

  const offerings = await listPractitionerOfferings({
    serviceId,
    branchId,
    allowPatientChoice: true,
    activeOnly: true,
    publishedOnly: true,
  });
  if (offerings.length === 0) return NextResponse.json({ doctors: [] });

  const dp = getDataProvider();

  const doctors = await Promise.all(
    offerings.map(async (offering) => {
      const [practitioner, config] = await Promise.all([
        dp.getPractitionerById(offering.specialistOpenemrUuid).catch(() => null),
        getEffectiveOfferingConfiguration(offering.id),
      ]);
      if (!practitioner || !practitioner.active || !config) return null;

      const { nextSlot, previewSlots } = await getAvailabilitySummary(
        dp,
        offering.specialistOpenemrUuid,
        branchId,
        config.durationMinutes,
        range,
      );
      if (range && !nextSlot) return null; // nothing in the chosen range — drop, don't show as unavailable

      return {
        uuid: offering.specialistOpenemrUuid,
        departmentId: offering.departmentId,
        name: `${practitioner.title} ${practitioner.firstName} ${practitioner.lastName}`.trim(),
        specialty: practitioner.specialty,
        photoUrl: practitioner.photoUrl ?? null,
        durationMinutes: config.durationMinutes,
        priceMinor: config.priceMinor,
        nextSlot,
        previewSlots,
        assignmentPriorityTier: offering.assignmentPriorityTier,
        assignmentPriority: offering.assignmentPriority,
      };
    }),
  );

  // Soonest slot is the primary signal, but doctors whose soonest slot falls
  // on the same calendar day are then ordered by the clinic's own priority
  // tier/number — the same ordering rankAutoAssignmentCandidates uses for
  // auto-assignment — before falling back to exact time.
  const sorted = doctors
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .sort((a, b) => {
      if (!a.nextSlot && !b.nextSlot) return 0;
      if (!a.nextSlot) return 1; // no availability sorts last
      if (!b.nextSlot) return -1;

      const dayA = a.nextSlot.start.slice(0, 10);
      const dayB = b.nextSlot.start.slice(0, 10);
      if (dayA !== dayB) return dayA.localeCompare(dayB);

      const tier = PRIORITY_TIER_ORDER[a.assignmentPriorityTier] - PRIORITY_TIER_ORDER[b.assignmentPriorityTier];
      if (tier !== 0) return tier;
      if (a.assignmentPriority !== b.assignmentPriority) return a.assignmentPriority - b.assignmentPriority;

      return a.nextSlot.start.localeCompare(b.nextSlot.start);
    })
    .map(({ assignmentPriorityTier: _t, assignmentPriority: _p, ...doctor }) => doctor);

  return NextResponse.json({ doctors: sorted });
}
