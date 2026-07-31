import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/data';
import { getBookableService, getServiceSpecialistIds } from '@/lib/data/service-catalog';
import { getBranchBySlug, restrictToBranch } from '@/lib/data/reference-repo';
import type { Slot } from '@/lib/data/types';

/**
 * Aggregated availability for a service: the union of free slots across every
 * eligible specialist, collapsed by identical start/end. The specialist that
 * will actually be booked is chosen in the next step (see
 * /api/services/[id]/specialists-for-slot) — this endpoint intentionally never
 * returns a practitionerId.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const branchSlug = searchParams.get('branch');
  if (!from || !to) return NextResponse.json({ error: 'from and to are required' }, { status: 400 });

  // This endpoint backs the service-search flow only, so doctor-only services
  // (showInServiceSearch=false) are rejected here too — defense in depth
  // against reaching a hidden service by direct URL.
  const service = await getBookableService(id);
  if (!service || !service.active || !service.showInServiceSearch) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const provider = getDataProvider();
  const branch = branchSlug ? await getBranchBySlug(branchSlug) : null;

  const roster = await provider.getPractitioners({ activeOnly: true });
  const configuredUuids = await getServiceSpecialistIds(service.id);
  const eligible = configuredUuids.length > 0
    ? roster.filter((practitioner) => configuredUuids.includes(practitioner.id))
    : roster;
  // Only offer times the patient can actually be seen at, at the branch they chose.
  const available = await restrictToBranch(eligible, branch?.id);

  const entries = await Promise.all(
    available.map(
      async (practitioner) =>
        [
          practitioner.id,
          await provider.getAvailableSlots(practitioner.id, from, to, service.durationMinutes, {
            branchId: branch?.id,
          }),
        ] as const,
    ),
  );

  // Union by identical [start, end) — the patient only sees "9:00 AM is open,"
  // not which of the N eligible specialists holds it.
  const merged = new Map<string, Slot>();
  for (const [, slots] of entries) {
    for (const slot of slots) {
      if (!slot.available) continue;
      const key = `${slot.start}|${slot.end}`;
      if (!merged.has(key)) merged.set(key, { ...slot, practitionerId: '' });
    }
  }
  const slots = Array.from(merged.values()).sort((a, b) => a.start.localeCompare(b.start));

  return NextResponse.json({ slots });
}
