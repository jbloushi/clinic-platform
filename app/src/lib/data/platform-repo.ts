import { prisma } from '@/lib/db';
import type { AvailabilityRule } from './types';

/**
 * The platform-owned side of the data layer: practitioner availability rules,
 * services, wallet, bookings, etc. Stored in our Prisma DB.
 *
 * We store availability keyed by the OpenEMR practitioner id (uuid). If no
 * row exists yet, we fall back to a sensible default so booking is usable
 * even before Admin has configured a schedule.
 */

const DEFAULT_AVAILABILITY: AvailabilityRule[] = [
  { dayOfWeek: 1, startTime: '09:00', endTime: '13:00', slotMinutes: 20 },
  { dayOfWeek: 2, startTime: '09:00', endTime: '13:00', slotMinutes: 20 },
  { dayOfWeek: 3, startTime: '09:00', endTime: '13:00', slotMinutes: 20 },
  { dayOfWeek: 4, startTime: '14:00', endTime: '18:00', slotMinutes: 20 },
  { dayOfWeek: 0, startTime: '09:00', endTime: '13:00', slotMinutes: 20 },
];

// Availability is stored in AuditLog-adjacent way for demo simplicity:
// we keep a single row per practitioner in a JSON blob in AuditLog with a specific action.
// (Keeping the demo schema slim — a real deployment would add a PractitionerAvailability model.)

const AVAILABILITY_ACTION = 'practitioner.availability.set';

export async function getPractitionerAvailability(practitionerId: string): Promise<AvailabilityRule[]> {
  const row = await prisma.auditLog.findFirst({
    where: { action: AVAILABILITY_ACTION, target: practitionerId },
    orderBy: { createdAt: 'desc' },
  });
  if (!row?.metadata) return DEFAULT_AVAILABILITY;
  try {
    const parsed = JSON.parse(row.metadata) as AvailabilityRule[];
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_AVAILABILITY;
  } catch {
    return DEFAULT_AVAILABILITY;
  }
}

export async function setPractitionerAvailability(
  practitionerId: string,
  rules: AvailabilityRule[],
  actor: string,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actor,
      action: AVAILABILITY_ACTION,
      target: practitionerId,
      metadata: JSON.stringify(rules),
    },
  });
}

// ---------- Services ----------

export function listServices() {
  return prisma.service.findMany({ orderBy: { name: 'asc' } });
}

// ---------- Service <-> specialist eligibility ----------
//
// Kept Prisma-only (no OpenEMR reads here, to avoid a circular import with
// the OpenEMR provider, which already imports this file for availability).
// getServiceSpecialistUuids returns the RAW join rows — an empty array means
// "no rows configured yet", not "no specialists eligible". Callers that need
// booking-time eligibility (empty = any active specialist) apply that
// fallback themselves once they already have the active specialist list in
// hand (see provider.ts's getEligibleSpecialistUuids in Phase 3).

export async function getServiceSpecialistUuids(serviceId: string): Promise<string[]> {
  const rows = await prisma.serviceSpecialist.findMany({
    where: { serviceId },
    select: { specialistOpenemrUuid: true },
  });
  return rows.map((r) => r.specialistOpenemrUuid);
}

/** Atomically replace the full set of specialists eligible for a service. */
export async function setServiceSpecialists(serviceId: string, specialistUuids: string[]): Promise<void> {
  const unique = Array.from(new Set(specialistUuids));
  await prisma.$transaction([
    prisma.serviceSpecialist.deleteMany({ where: { serviceId } }),
    ...(unique.length
      ? [
          prisma.serviceSpecialist.createMany({
            data: unique.map((specialistOpenemrUuid) => ({ serviceId, specialistOpenemrUuid })),
          }),
        ]
      : []),
  ]);
}

/** Inverse of getServiceSpecialistUuids: the services a given specialist is explicitly linked to. */
export async function getServicesForSpecialist(specialistUuid: string): Promise<string[]> {
  const rows = await prisma.serviceSpecialist.findMany({
    where: { specialistOpenemrUuid: specialistUuid },
    select: { serviceId: true },
  });
  return rows.map((r) => r.serviceId);
}

/** Atomically replace the full set of services a specialist is eligible for. */
export async function setSpecialistServices(specialistUuid: string, serviceIds: string[]): Promise<void> {
  const unique = Array.from(new Set(serviceIds));
  await prisma.$transaction([
    prisma.serviceSpecialist.deleteMany({ where: { specialistOpenemrUuid: specialistUuid } }),
    ...(unique.length
      ? [
          prisma.serviceSpecialist.createMany({
            data: unique.map((serviceId) => ({ serviceId, specialistOpenemrUuid: specialistUuid })),
          }),
        ]
      : []),
  ]);
}

/**
 * Confirmed-booking counts per specialist since a given date — used by the
 * auto-assign load-balancing tie-break (fewest recent bookings first).
 */
export async function getBookingCountsSince(
  specialistUuids: string[],
  since: Date,
): Promise<Map<string, number>> {
  if (specialistUuids.length === 0) return new Map();
  const rows = await prisma.bookingHold.groupBy({
    by: ['practitionerOpenemrId'],
    where: {
      practitionerOpenemrId: { in: specialistUuids },
      status: 'confirmed',
      createdAt: { gte: since },
    },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.practitionerOpenemrId, r._count._all]));
}

// ---------- Wallet ----------

export async function getWalletBalance(patientId: string): Promise<number> {
  const rows = await prisma.walletTransaction.findMany({ where: { patientId } });
  return rows.reduce((sum, r) => sum + r.amountMinor, 0);
}

export function listWalletTransactions(patientId: string) {
  return prisma.walletTransaction.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } });
}
