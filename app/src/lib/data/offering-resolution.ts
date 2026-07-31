import type { AssignmentPriorityTier, PractitionerSelectionMode } from '@prisma/client';

/**
 * Resolution of what a booking actually costs and how long it takes, and
 * whether a given combination is bookable at all.
 *
 * Pure functions over already-loaded rows: no database, no OpenEMR, no clock.
 * That is deliberate — these are the rules a patient's price and a doctor's
 * eligibility depend on, and they need to be testable without a fixture stack.
 */

/** Narrow shapes so callers can pass Prisma rows or plain objects. */
export type ServiceDefaults = { durationMinutes: number; priceMinor: number };
export type BranchOverride = { durationMinutes: number | null; priceMinor: number | null };
export type OfferingOverride = { durationMinutes: number | null; priceMinor: number | null };

export type EffectiveConfiguration = {
  durationMinutes: number;
  priceMinor: number;
  /** Which level supplied each value — shown in ops so an override is visible. */
  durationSource: 'offering' | 'branch' | 'service';
  priceSource: 'offering' | 'branch' | 'service';
};

/**
 * Narrowest override wins: offering, then branch, then the service default.
 *
 * Null means "inherit", not "free" or "instant" — so a branch that only differs
 * on price records only a price, and a later change to the service duration
 * still reaches it.
 */
export function resolveEffectiveConfiguration(
  service: ServiceDefaults,
  branch?: BranchOverride | null,
  offering?: OfferingOverride | null,
): EffectiveConfiguration {
  const duration = offering?.durationMinutes ?? branch?.durationMinutes ?? service.durationMinutes;
  const price = offering?.priceMinor ?? branch?.priceMinor ?? service.priceMinor;

  return {
    durationMinutes: duration,
    priceMinor: price,
    durationSource:
      offering?.durationMinutes != null
        ? 'offering'
        : branch?.durationMinutes != null
          ? 'branch'
          : 'service',
    priceSource:
      offering?.priceMinor != null ? 'offering' : branch?.priceMinor != null ? 'branch' : 'service',
  };
}

// ---------------------------------------------------------------------------
// Offering validity
// ---------------------------------------------------------------------------

export type OfferingValidationInput = {
  practitionerActiveInEmr: boolean;
  practitionerAssignedToBranch: boolean;
  serviceActiveAtBranch: boolean;
  serviceInDepartment: boolean;
  branchOperational: boolean;
  serviceOperational: boolean;
  departmentOperational: boolean;
  offeringActive: boolean;
};

export type OfferingValidationFailure =
  | 'practitioner_inactive'
  | 'practitioner_not_at_branch'
  | 'service_not_at_branch'
  | 'service_not_in_department'
  | 'branch_not_operational'
  | 'service_not_operational'
  | 'department_not_operational'
  | 'offering_inactive';

/**
 * Every reason a doctor/branch/department/service combination is not bookable.
 *
 * Returns all failures rather than the first, because ops fixing one only to
 * hit the next is the slowest possible way to configure a clinic.
 *
 * Note what is NOT here: nothing infers an offering from its parts. A doctor
 * working at a branch, that branch offering the service, and the doctor sitting
 * in that department still do not make an offering — the explicit row must
 * exist. This function only checks that an existing row's parents hold up.
 */
export function validateOffering(input: OfferingValidationInput): OfferingValidationFailure[] {
  const failures: OfferingValidationFailure[] = [];
  if (!input.practitionerActiveInEmr) failures.push('practitioner_inactive');
  if (!input.practitionerAssignedToBranch) failures.push('practitioner_not_at_branch');
  if (!input.serviceActiveAtBranch) failures.push('service_not_at_branch');
  if (!input.serviceInDepartment) failures.push('service_not_in_department');
  if (!input.branchOperational) failures.push('branch_not_operational');
  if (!input.serviceOperational) failures.push('service_not_operational');
  if (!input.departmentOperational) failures.push('department_not_operational');
  if (!input.offeringActive) failures.push('offering_inactive');
  return failures;
}

// ---------------------------------------------------------------------------
// Selection mode
// ---------------------------------------------------------------------------

export type OfferingCapability = {
  allowAutoAssignment: boolean;
  allowPatientChoice: boolean;
};

/**
 * Whether a service's configured doctor-selection mode can actually be honoured
 * by the offerings behind it.
 *
 * A service set to AUTO with no auto-assignable doctor is the failure this
 * exists to catch: it looks configured, passes every per-row check, and then
 * produces a booking page with no obtainable appointment.
 */
export function canSatisfySelectionMode(
  mode: PractitionerSelectionMode,
  offerings: OfferingCapability[],
): boolean {
  const auto = offerings.some((o) => o.allowAutoAssignment);
  const choice = offerings.some((o) => o.allowPatientChoice);

  switch (mode) {
    case 'AUTO':
      return auto;
    case 'PATIENT_CHOICE':
      return choice;
    case 'AUTO_OR_PATIENT_CHOICE':
      // The default path is first-available, so auto is what must work; patient
      // choice is an alternative the patient may not take.
      return auto || choice;
    case 'OPS_ONLY':
      // Never publicly bookable, so there is nothing public to satisfy.
      return true;
  }
}

/** Tier ordering used by the assignment engine; lower sorts first. */
export const PRIORITY_TIER_ORDER: Record<AssignmentPriorityTier, number> = {
  PREFERRED: 0,
  NORMAL: 1,
  BACKUP: 2,
};
