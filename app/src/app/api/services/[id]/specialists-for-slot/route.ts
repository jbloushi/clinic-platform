import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/data';
import { getBookableService, getServiceSpecialistIds } from '@/lib/data/service-catalog';
import { getBranchBySlug, restrictToBranch } from '@/lib/data/reference-repo';
import { getBookingCountsSince } from '@/lib/data/platform-repo';

/**
 * Which specialists can actually take a given [start, end) for a service.
 *
 * The aggregated slot list at /slots deliberately hides who holds each time, so
 * once the patient picks one this endpoint reopens the question: it returns the
 * eligible specialists who are genuinely free for that exact slot, least-loaded
 * first, for the patient to choose between.
 *
 * Availability is recomputed here rather than trusted from the slot list — the
 * list is a moment old and a specialist may have been booked since. This is
 * still only a display filter: /api/bookings revalidates before committing, and
 * the BookingHold unique constraint remains the real gate against a race.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const branchSlug = searchParams.get('branch');
  if (!start || !end) {
    return NextResponse.json({ error: 'start and end are required' }, { status: 400 });
  }

  // Same guard as /slots — a doctor-only service isn't reachable from the
  // patient-facing service search, by direct URL either.
  const service = await getBookableService(id);
  if (!service || !service.active || !service.showInServiceSearch) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const dp = getDataProvider();
  const branch = branchSlug ? await getBranchBySlug(branchSlug) : null;
  const configured = await getServiceSpecialistIds(service.id);
  const roster = await dp.getPractitioners({ activeOnly: true });
  // Zero configured links means "any active specialist" — the same fallback
  // /api/bookings applies, so the picker can't offer a doctor the commit would
  // reject (or hide one it would have accepted).
  const configuredEligible =
    configured.length > 0 ? roster.filter((p) => configured.includes(p.id)) : roster;
  const eligible = await restrictToBranch(configuredEligible, branch?.id);

  const day = start.slice(0, 10);
  const free = await Promise.all(
    eligible.map(async (specialist) => {
      const slots = await dp
        .getAvailableSlots(specialist.id, day, day, service.durationMinutes, {
          branchId: branch?.id,
        })
        .catch(() => []);
      const open = slots.some((slot) => slot.available && slot.start === start && slot.end === end);
      return open ? specialist : null;
    }),
  );
  const available = free.filter((s): s is NonNullable<typeof s> => s !== null);

  // Least-loaded first so the roster shares work evenly, ties broken by name for
  // a stable order across reloads.
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const counts = await getBookingCountsSince(
    available.map((s) => s.id),
    since,
  ).catch(() => new Map<string, number>());

  const specialists = [...available]
    .sort((a, b) => {
      const load = (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0);
      if (load !== 0) return load;
      return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`);
    })
    .map((s) => ({
      id: s.id,
      name: `${s.title} ${s.firstName} ${s.lastName}`.trim(),
      firstName: s.firstName,
      lastName: s.lastName,
      specialty: s.specialty,
      role: s.role,
      photoUrl: s.photoUrl ?? null,
    }));

  return NextResponse.json({ specialists });
}
