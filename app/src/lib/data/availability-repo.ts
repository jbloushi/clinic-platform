import { prisma } from '@/lib/db';
import type { AvailabilityRule } from './types';

/**
 * Real, queryable replacement for the JSON blob `getPractitionerAvailability`
 * used to read from `AuditLog`. Same fallback semantics as the blob (see
 * `platform-repo.ts`), so switching callers over changes nothing observable
 * for a practitioner who has no rows yet.
 */

const DEFAULT_AVAILABILITY: AvailabilityRule[] = [
  { dayOfWeek: 1, startTime: '09:00', endTime: '13:00', slotMinutes: 20 },
  { dayOfWeek: 2, startTime: '09:00', endTime: '13:00', slotMinutes: 20 },
  { dayOfWeek: 3, startTime: '09:00', endTime: '13:00', slotMinutes: 20 },
  { dayOfWeek: 4, startTime: '14:00', endTime: '18:00', slotMinutes: 20 },
  { dayOfWeek: 0, startTime: '09:00', endTime: '13:00', slotMinutes: 20 },
];

/**
 * A practitioner's weekly availability, optionally narrowed to one branch.
 *
 * No rows at all for this practitioner → `DEFAULT_AVAILABILITY` (unconfigured
 * stays bookable everywhere, matching the blob's fallback). Rows exist but
 * none apply to the requested branch → empty, not the default — that
 * practitioner genuinely doesn't work there.
 */
export async function listAvailabilityRules(
  specialistUuid: string,
  branchId?: string,
): Promise<AvailabilityRule[]> {
  const now = new Date();
  const rows = await prisma.availabilityRule.findMany({
    where: {
      specialistOpenemrUuid: specialistUuid,
      active: true,
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
        { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
      ],
    },
    orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
  });

  const allRulesExist = await prisma.availabilityRule.count({
    where: { specialistOpenemrUuid: specialistUuid },
  });
  if (allRulesExist === 0) return DEFAULT_AVAILABILITY;

  const mapped: AvailabilityRule[] = rows.map((row) => ({
    dayOfWeek: row.weekday as AvailabilityRule['dayOfWeek'],
    startTime: row.startTime,
    endTime: row.endTime,
    slotMinutes: row.slotMinutes,
    branchId: row.branchId ?? undefined,
  }));

  if (!branchId) return mapped;
  return mapped.filter((rule) => !rule.branchId || rule.branchId === branchId);
}

export type AvailabilityRuleWrite = {
  branchId?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes?: number;
  validFrom?: Date | null;
  validUntil?: Date | null;
  active?: boolean;
};

/** Atomically replace a practitioner's full rule set. */
export async function upsertAvailabilityRules(
  specialistUuid: string,
  rules: AvailabilityRuleWrite[],
): Promise<void> {
  await prisma.$transaction([
    prisma.availabilityRule.deleteMany({ where: { specialistOpenemrUuid: specialistUuid } }),
    prisma.availabilityRule.createMany({
      data: rules.map((rule) => ({
        specialistOpenemrUuid: specialistUuid,
        branchId: rule.branchId ?? null,
        weekday: rule.dayOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        slotMinutes: rule.slotMinutes ?? 20,
        validFrom: rule.validFrom ?? null,
        validUntil: rule.validUntil ?? null,
        active: rule.active ?? true,
      })),
    }),
  ]);
}
