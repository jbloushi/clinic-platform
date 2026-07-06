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

// ---------- Wallet ----------

export async function getWalletBalance(patientId: string): Promise<number> {
  const rows = await prisma.walletTransaction.findMany({ where: { patientId } });
  return rows.reduce((sum, r) => sum + r.amountMinor, 0);
}

export function listWalletTransactions(patientId: string) {
  return prisma.walletTransaction.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } });
}
