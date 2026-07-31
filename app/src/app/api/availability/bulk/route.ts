import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/data';
import { listPractitionerOfferings, getEffectiveOfferingConfiguration } from '@/lib/data/offering-repo';
import type { Slot } from '@/lib/data/types';

/**
 * Collective "first available" slots for a service at a branch, across the
 * whole auto-assignable offering pool — nothing today produces a
 * doctor-agnostic slot list for the new offering model (the old
 * `/api/services/[id]/slots` still walks `ServiceSpecialist`, not
 * `PractitionerOffering`).
 *
 * A slot is available if ANY eligible doctor is free for it — the specific
 * doctor is decided at hold-creation time by the assignment engine, not here.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get('serviceId');
  const branchId = searchParams.get('branchId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!serviceId || !branchId || !from || !to) {
    return NextResponse.json({ error: 'serviceId, branchId, from and to are required' }, { status: 400 });
  }

  const offerings = await listPractitionerOfferings({
    serviceId,
    branchId,
    allowAutoAssignment: true,
    activeOnly: true,
    publishedOnly: true,
  });
  if (offerings.length === 0) return NextResponse.json({ slots: [] });

  const config = await getEffectiveOfferingConfiguration(offerings[0].id);
  const durationMinutes = config?.durationMinutes;

  const dp = getDataProvider();
  const perDoctor = await Promise.all(
    offerings.map((offering) =>
      dp.getAvailableSlots(offering.specialistOpenemrUuid, from, to, durationMinutes, { branchId }),
    ),
  );

  // Union by (start, end): available the moment any candidate is free for it.
  const byKey = new Map<string, Slot>();
  for (const doctorSlots of perDoctor) {
    for (const slot of doctorSlots) {
      if (!slot.available) continue;
      const key = `${slot.start}|${slot.end}`;
      if (!byKey.has(key)) {
        byKey.set(key, { practitionerId: '', start: slot.start, end: slot.end, available: true });
      }
    }
  }
  const slots = Array.from(byKey.values()).sort((a, b) => a.start.localeCompare(b.start));
  return NextResponse.json({ slots });
}
