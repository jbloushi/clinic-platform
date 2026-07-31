import type { AssignmentPriorityTier } from '@prisma/client';
import { PRIORITY_TIER_ORDER } from './offering-resolution';

/**
 * Deterministic ranking of the doctors who could take a given appointment.
 *
 * Pure and clock-free: every input the decision depends on is passed in, so the
 * same inputs always produce the same order. That matters beyond testability —
 * an assignment that cannot be reproduced cannot be explained to a patient who
 * asks why they were given a particular doctor, or audited when a rota looks
 * unfair.
 *
 * Explicitly not random. Random assignment is untestable, unexplainable, and
 * hides a skewed rota behind plausible-looking noise.
 */

export type AssignmentReason =
  | 'previous_doctor'
  | 'offering_priority'
  | 'lowest_active_load'
  | 'least_recently_assigned'
  | 'round_robin'
  | 'stable_tiebreaker';

export type AssignmentCandidate = {
  specialistOpenemrUuid: string;
  practitionerOfferingId: string;
  assignmentPriority: number;
  assignmentPriorityTier: AssignmentPriorityTier;
  /** Confirmed bookings inside the configured comparison window. */
  activeLoad: number;
  /** When the engine last chose this offering; null means never. */
  lastAutoAssignedAt: Date | null;
};

export type AssignmentRules = {
  preferPreviousPractitioner: boolean;
  useLeastRecentlyAssigned: boolean;
  allowBackupTier: boolean;
};

export const DEFAULT_ASSIGNMENT_RULES: AssignmentRules = {
  preferPreviousPractitioner: true,
  useLeastRecentlyAssigned: true,
  allowBackupTier: true,
};

export type RankedCandidate = AssignmentCandidate & {
  /** Why this candidate landed where it did, for the audit trail. */
  reason: AssignmentReason;
};

/**
 * Order the eligible candidates best-first.
 *
 * Ranking, in order:
 *  1. the patient's previous doctor, for a follow-up — continuity of care beats
 *     load balancing, and a patient asked to re-explain their history to a new
 *     clinician has been failed by the scheduler;
 *  2. priority tier (preferred → normal → backup), then the numeric priority
 *     inside it, so a clinic's own ordering is honoured before any heuristic;
 *  3. lowest current load, which is the actual fairness mechanism;
 *  4. least recently assigned, breaking equal-load ties toward rotation;
 *  5. UUID, so the result is total and stable rather than dependent on the
 *     order rows came back from the database.
 *
 * Backup-tier candidates are dropped entirely when a non-backup one exists —
 * "backup" means "only if nobody else can", not "slightly later in the list".
 */
export function rankAutoAssignmentCandidates(
  candidates: AssignmentCandidate[],
  options: {
    rules?: AssignmentRules;
    previousPractitionerUuid?: string | null;
    isFollowUp?: boolean;
  } = {},
): RankedCandidate[] {
  const rules = options.rules ?? DEFAULT_ASSIGNMENT_RULES;
  if (candidates.length === 0) return [];

  let pool = candidates;

  // Backup doctors are a last resort, not a tail. Only fall through to them
  // when the preferred and normal tiers are empty.
  const nonBackup = pool.filter((c) => c.assignmentPriorityTier !== 'BACKUP');
  if (nonBackup.length > 0) {
    pool = nonBackup;
  } else if (!rules.allowBackupTier) {
    return [];
  }

  const previousUuid =
    rules.preferPreviousPractitioner && options.isFollowUp ? options.previousPractitionerUuid : null;

  const sorted = [...pool].sort((a, b) => {
    // 1. Continuity for follow-ups.
    if (previousUuid) {
      const aPrev = a.specialistOpenemrUuid === previousUuid ? 0 : 1;
      const bPrev = b.specialistOpenemrUuid === previousUuid ? 0 : 1;
      if (aPrev !== bPrev) return aPrev - bPrev;
    }

    // 2. Clinic-configured ordering: tier first, then the number within it.
    const tier =
      PRIORITY_TIER_ORDER[a.assignmentPriorityTier] - PRIORITY_TIER_ORDER[b.assignmentPriorityTier];
    if (tier !== 0) return tier;
    if (a.assignmentPriority !== b.assignmentPriority) {
      return a.assignmentPriority - b.assignmentPriority;
    }

    // 3. Fairness.
    if (a.activeLoad !== b.activeLoad) return a.activeLoad - b.activeLoad;

    // 4. Rotation. Never-assigned sorts first so a new doctor enters the rota
    //    rather than waiting behind everyone else's older timestamps.
    if (rules.useLeastRecentlyAssigned) {
      const aAt = a.lastAutoAssignedAt?.getTime() ?? -Infinity;
      const bAt = b.lastAutoAssignedAt?.getTime() ?? -Infinity;
      if (aAt !== bAt) return aAt - bAt;
    }

    // 5. Total order, independent of database row order.
    return a.specialistOpenemrUuid.localeCompare(b.specialistOpenemrUuid);
  });

  return sorted.map((candidate) => ({
    ...candidate,
    reason: reasonFor(candidate, sorted, previousUuid, rules),
  }));
}

/**
 * Which rule actually decided this candidate's place.
 *
 * Attributed by finding the first criterion on which it differs from the rest
 * of the pool, so the audit trail records the operative reason rather than the
 * last comparator that happened to run.
 */
function reasonFor(
  candidate: AssignmentCandidate,
  pool: AssignmentCandidate[],
  previousUuid: string | null | undefined,
  rules: AssignmentRules,
): AssignmentReason {
  if (previousUuid && candidate.specialistOpenemrUuid === previousUuid) return 'previous_doctor';

  const others = pool.filter((c) => c.practitionerOfferingId !== candidate.practitionerOfferingId);
  if (others.length === 0) return 'stable_tiebreaker';

  const differsOnPriority = others.some(
    (o) =>
      o.assignmentPriorityTier !== candidate.assignmentPriorityTier ||
      o.assignmentPriority !== candidate.assignmentPriority,
  );
  if (differsOnPriority) return 'offering_priority';

  if (others.some((o) => o.activeLoad !== candidate.activeLoad)) return 'lowest_active_load';

  if (
    rules.useLeastRecentlyAssigned &&
    others.some(
      (o) => (o.lastAutoAssignedAt?.getTime() ?? -Infinity) !== (candidate.lastAutoAssignedAt?.getTime() ?? -Infinity),
    )
  ) {
    return 'least_recently_assigned';
  }

  return 'stable_tiebreaker';
}

/**
 * Time buckets a booking occupies, used to write overlap locks.
 *
 * One row per quantum rather than a single row per booking, because a unique
 * index can only reject an identical key: two bookings that merely overlap
 * produce different start instants and would both succeed. Sharing any bucket
 * guarantees a collision.
 *
 * The end is exclusive — a 10:00–10:30 booking must not block 10:30–11:00.
 */
export function slotBuckets(start: Date, end: Date, quantumMinutes: number): Date[] {
  if (quantumMinutes <= 0) throw new Error('quantumMinutes must be positive');

  const quantumMs = quantumMinutes * 60_000;
  const startMs = Math.floor(start.getTime() / quantumMs) * quantumMs;
  const endMs = end.getTime();
  if (endMs <= startMs) return [];

  const buckets: Date[] = [];
  for (let t = startMs; t < endMs; t += quantumMs) buckets.push(new Date(t));
  return buckets;
}
