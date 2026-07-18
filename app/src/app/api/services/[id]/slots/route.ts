import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAvailableSlotsBulk, getEligibleSpecialistUuids } from '@/lib/data/openemr/provider';
import type { Slot } from '@/lib/data/types';

/**
 * Aggregated availability for a service: the union of free slots across every
 * eligible specialist, collapsed by identical start/end. The specialist that
 * will actually be booked is decided at commit time (see /api/bookings) —
 * this endpoint intentionally never returns a practitionerId.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!from || !to) return NextResponse.json({ error: 'from and to are required' }, { status: 400 });

  // This endpoint backs the service-search flow only, so doctor-only services
  // (showInServiceSearch=false) are rejected here too — defense in depth
  // against reaching a hidden service by direct URL.
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service || !service.active || !service.showInServiceSearch) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const eligibleUuids = await getEligibleSpecialistUuids(id);
  const byUuid = await getAvailableSlotsBulk(eligibleUuids, from, to, service.durationMinutes);

  // Union by identical [start, end) — the patient only sees "9:00 AM is open,"
  // not which of the N eligible specialists holds it.
  const merged = new Map<string, Slot>();
  for (const uuid of eligibleUuids) {
    for (const slot of byUuid[uuid] ?? []) {
      if (!slot.available) continue;
      const key = `${slot.start}|${slot.end}`;
      if (!merged.has(key)) merged.set(key, { ...slot, practitionerId: '' });
    }
  }
  const slots = Array.from(merged.values()).sort((a, b) => a.start.localeCompare(b.start));

  return NextResponse.json({ slots });
}
