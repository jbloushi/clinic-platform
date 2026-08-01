import { prisma } from '@/lib/db';

/**
 * Minimum gap required between a doctor's appointments at two DIFFERENT
 * branches. Per-doctor override wins; a missing override row falls back to
 * the clinic-wide default on AssignmentSettings.
 */
export async function getTravelBufferMinutes(specialistOpenemrUuid: string): Promise<number> {
  const [override, settings] = await Promise.all([
    prisma.practitionerTravelBuffer.findUnique({
      where: { specialistOpenemrUuid },
      select: { bufferMinutes: true },
    }),
    prisma.assignmentSettings.findUnique({
      where: { id: 'singleton' },
      select: { crossBranchBufferMinutes: true },
    }),
  ]);
  return override?.bufferMinutes ?? settings?.crossBranchBufferMinutes ?? 45;
}

export type EpochRange = { start: number; end: number };

/**
 * Pads every range by bufferMinutes on both sides. Pure and clock-free: the
 * caller decides which ranges are "elsewhere" (cross-branch) before this
 * runs — same-branch ranges must never be passed in, since back-to-back
 * bookings at one location need no travel padding.
 */
export function applyTravelBuffer(elsewhereRanges: EpochRange[], bufferMinutes: number): EpochRange[] {
  if (bufferMinutes <= 0) return elsewhereRanges;
  const pad = bufferMinutes * 60_000;
  return elsewhereRanges.map((r) => ({ start: r.start - pad, end: r.end + pad }));
}

/**
 * Cross-branch blocking ranges for a doctor: their active holds at any OTHER
 * branch overlapping [from, to], padded by the effective travel buffer.
 *
 * Shaped as plain {start,end} epoch-ms ranges — the same shape
 * `fetchBookedRanges` (OpenEMR-derived) already produces — so callers can
 * simply concatenate this into that array before generating slots, with no
 * separate overlap-checking path required.
 *
 * Sourced from the platform's own BookingHold table (not OpenEMR) because it
 * already carries branchId directly; OpenEMR appointments don't expose which
 * facility they're at without an extra mapping step. Known limitation: an
 * appointment entered directly in OpenEMR by staff (not through this
 * platform) has no BookingHold row and won't be buffered against.
 */
export async function getCrossBranchBufferRanges(
  specialistOpenemrUuid: string,
  targetBranchId: string,
  from: Date,
  to: Date,
): Promise<EpochRange[]> {
  const [bufferMinutes, holds] = await Promise.all([
    getTravelBufferMinutes(specialistOpenemrUuid),
    prisma.bookingHold.findMany({
      where: {
        practitionerOpenemrId: specialistOpenemrUuid,
        branchId: { not: targetBranchId },
        status: { in: ['held', 'pending_payment', 'confirmed'] },
        startAt: { lt: to },
        endAt: { gt: from },
      },
      select: { startAt: true, endAt: true },
    }),
  ]);

  const elsewhere = holds.map((h) => ({ start: h.startAt.getTime(), end: h.endAt.getTime() }));
  return applyTravelBuffer(elsewhere, bufferMinutes);
}
