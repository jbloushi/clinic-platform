import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/data';
import { listPractitionerOfferings, getEffectiveOfferingConfiguration } from '@/lib/data/offering-repo';
import { getNextAvailableSlot } from '@/lib/booking/next-available';

/**
 * Per-doctor earliest availability for a service at a branch, sorted soonest
 * first — backs the service-path "recommended doctor + other doctors" list.
 * Only offerings a patient may actually pick by name (`allowPatientChoice`)
 * are listed: nothing here is choosable through this endpoint that couldn't
 * also be booked by tapping its card.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get('serviceId');
  const branchId = searchParams.get('branchId');
  if (!serviceId || !branchId) {
    return NextResponse.json({ error: 'serviceId and branchId are required' }, { status: 400 });
  }

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

      const nextSlot = await getNextAvailableSlot(
        dp,
        offering.specialistOpenemrUuid,
        branchId,
        config.durationMinutes,
      );

      return {
        uuid: offering.specialistOpenemrUuid,
        departmentId: offering.departmentId,
        name: `${practitioner.title} ${practitioner.firstName} ${practitioner.lastName}`.trim(),
        specialty: practitioner.specialty,
        photoUrl: practitioner.photoUrl ?? null,
        durationMinutes: config.durationMinutes,
        priceMinor: config.priceMinor,
        nextSlot,
      };
    }),
  );

  const sorted = doctors
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .sort((a, b) => {
      if (!a.nextSlot && !b.nextSlot) return 0;
      if (!a.nextSlot) return 1; // no availability sorts last
      if (!b.nextSlot) return -1;
      return a.nextSlot.start.localeCompare(b.nextSlot.start);
    });

  return NextResponse.json({ doctors: sorted });
}
