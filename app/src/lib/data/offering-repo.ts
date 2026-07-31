import { prisma } from '@/lib/db';
import { normalizeSpecialty } from './specialty';
import {
  canSatisfySelectionMode,
  resolveEffectiveConfiguration,
  type EffectiveConfiguration,
} from './offering-resolution';

/**
 * Reads and writes over the offering graph — the explicit statement of which
 * doctor performs which service, under which department, at which branch.
 *
 * All relationship replacements are transactional: a partial write here leaves
 * a service published with no bookable doctor, which reads to a patient as a
 * broken clinic rather than a configuration error.
 */

// ---------------------------------------------------------------------------
// Service <-> department
// ---------------------------------------------------------------------------

export function listDepartmentsForService(serviceId: string) {
  return prisma.serviceDepartment.findMany({
    where: { serviceId },
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    include: { department: true },
  });
}

export async function getPrimaryDepartmentForService(serviceId: string) {
  const link = await prisma.serviceDepartment.findFirst({
    where: { serviceId, active: true, isPrimary: true },
    include: { department: true },
  });
  return link?.department ?? null;
}

export type ServiceDepartmentInput = {
  departmentId: string;
  isPrimary?: boolean;
  active?: boolean;
  sortOrder?: number;
};

/**
 * Replace a service's department memberships atomically.
 *
 * Rejects rather than repairs a set with no primary or several: silently
 * promoting the first would make the canonical breadcrumb, search label and
 * reporting category depend on array order, which is not something an operator
 * can see or intend.
 */
export async function setServiceDepartments(
  serviceId: string,
  links: ServiceDepartmentInput[],
): Promise<void> {
  const active = links.filter((link) => link.active !== false);
  const primaries = active.filter((link) => link.isPrimary);

  if (active.length > 0 && primaries.length !== 1) {
    throw new Error(
      `A service needs exactly one primary department; received ${primaries.length}.`,
    );
  }

  const ids = links.map((link) => link.departmentId);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Duplicate department in service department links.');
  }
  if (ids.length > 0) {
    const found = await prisma.department.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw new Error('Unknown department in service department links.');
  }

  await prisma.$transaction([
    prisma.serviceDepartment.deleteMany({ where: { serviceId } }),
    prisma.serviceDepartment.createMany({
      data: links.map((link, index) => ({
        serviceId,
        departmentId: link.departmentId,
        isPrimary: link.isPrimary ?? false,
        active: link.active ?? true,
        sortOrder: link.sortOrder ?? index,
      })),
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Service <-> branch
// ---------------------------------------------------------------------------

export function listServicesForBranch(branchId: string) {
  return prisma.serviceBranch.findMany({
    where: { branchId, active: true },
    orderBy: [{ sortOrder: 'asc' }],
    include: { service: true },
  });
}

export async function isServiceAvailableAtBranch(
  serviceId: string,
  branchId: string,
): Promise<boolean> {
  const link = await prisma.serviceBranch.findUnique({
    where: { serviceId_branchId: { serviceId, branchId } },
    select: { active: true, publishedOnWeb: true },
  });
  return Boolean(link?.active && link.publishedOnWeb);
}

// ---------------------------------------------------------------------------
// Practitioner <-> branch
// ---------------------------------------------------------------------------

export async function listBranchesForPractitioner(uuid: string): Promise<string[]> {
  const rows = await prisma.practitionerBranch.findMany({
    where: { specialistOpenemrUuid: uuid, active: true },
    select: { branchId: true },
  });
  return rows.map((row) => row.branchId);
}

/**
 * Whether a doctor may be booked at a branch.
 *
 * Absence is a "no". There is deliberately no fallback to OpenEMR's
 * `users.facility_id`: that field records where a doctor is based for OpenEMR's
 * own screens, and treating it as public booking eligibility would publish a
 * roster nobody in the clinic chose.
 */
export async function isPractitionerAssignedToBranch(
  uuid: string,
  branchId: string,
): Promise<boolean> {
  const row = await prisma.practitionerBranch.findUnique({
    where: { specialistOpenemrUuid_branchId: { specialistOpenemrUuid: uuid, branchId } },
    select: { active: true },
  });
  return Boolean(row?.active);
}

// ---------------------------------------------------------------------------
// Offerings
// ---------------------------------------------------------------------------

export type OfferingFilter = {
  branchId?: string;
  departmentId?: string;
  serviceId?: string;
  specialistOpenemrUuid?: string;
  allowAutoAssignment?: boolean;
  allowPatientChoice?: boolean;
  activeOnly?: boolean;
  publishedOnly?: boolean;
};

export function listPractitionerOfferings(filter: OfferingFilter = {}) {
  return prisma.practitionerOffering.findMany({
    where: {
      branchId: filter.branchId,
      departmentId: filter.departmentId,
      serviceId: filter.serviceId,
      specialistOpenemrUuid: filter.specialistOpenemrUuid,
      allowAutoAssignment: filter.allowAutoAssignment,
      allowPatientChoice: filter.allowPatientChoice,
      ...(filter.activeOnly ? { active: true } : {}),
      ...(filter.publishedOnly ? { publishedOnWeb: true } : {}),
    },
    orderBy: [{ assignmentPriorityTier: 'asc' }, { assignmentPriority: 'asc' }, { sortOrder: 'asc' }],
    include: { service: true, department: true, branch: true },
  });
}

export type OfferingWrite = {
  specialistOpenemrUuid: string;
  serviceId: string;
  departmentId: string;
  branchId: string;
  active?: boolean;
  publishedOnWeb?: boolean;
  allowAutoAssignment?: boolean;
  allowPatientChoice?: boolean;
  assignmentPriority?: number;
  assignmentPriorityTier?: 'PREFERRED' | 'NORMAL' | 'BACKUP';
  durationMinutes?: number | null;
  priceMinor?: number | null;
  sortOrder?: number;
};

/**
 * Create an offering, refusing to invent the relationships it depends on.
 *
 * Saving an offering does not quietly assign the doctor to the branch or add
 * the service there. Those are separate decisions with their own consequences —
 * a doctor assigned to a branch becomes bookable for everything else configured
 * there — and burying them inside another save is how a clinic ends up
 * published in a state nobody chose. The caller is told what is missing.
 */
export async function createPractitionerOffering(input: OfferingWrite) {
  const missing = await missingParentRelationships(input);
  if (missing.length > 0) {
    throw new OfferingParentError(missing);
  }
  return prisma.practitionerOffering.create({ data: normalizeOfferingWrite(input) });
}

export async function updatePractitionerOffering(id: string, input: Partial<OfferingWrite>) {
  return prisma.practitionerOffering.update({
    where: { id },
    data: {
      active: input.active,
      publishedOnWeb: input.publishedOnWeb,
      allowAutoAssignment: input.allowAutoAssignment,
      allowPatientChoice: input.allowPatientChoice,
      assignmentPriority: input.assignmentPriority,
      assignmentPriorityTier: input.assignmentPriorityTier,
      durationMinutes: input.durationMinutes,
      priceMinor: input.priceMinor,
      sortOrder: input.sortOrder,
    },
  });
}

/**
 * Remove an offering, or retire it when history depends on it.
 *
 * A confirmed appointment references the offering it was booked under; deleting
 * that row would strand the booking, so the offering is deactivated instead and
 * the appointment stays readable.
 */
export async function deletePractitionerOffering(id: string): Promise<{ deactivated: boolean }> {
  const bookings = await prisma.bookingHold.count({ where: { practitionerOfferingId: id } });
  if (bookings > 0) {
    await prisma.practitionerOffering.update({
      where: { id },
      data: { active: false, publishedOnWeb: false },
    });
    return { deactivated: true };
  }
  await prisma.practitionerOffering.delete({ where: { id } });
  return { deactivated: false };
}

export class OfferingParentError extends Error {
  constructor(public missing: string[]) {
    super(`Missing prerequisite relationships: ${missing.join(', ')}`);
    this.name = 'OfferingParentError';
  }
}

async function missingParentRelationships(input: OfferingWrite): Promise<string[]> {
  const [branchLink, departmentLink, practitionerLink] = await Promise.all([
    prisma.serviceBranch.findUnique({
      where: { serviceId_branchId: { serviceId: input.serviceId, branchId: input.branchId } },
      select: { active: true },
    }),
    prisma.serviceDepartment.findUnique({
      where: {
        serviceId_departmentId: { serviceId: input.serviceId, departmentId: input.departmentId },
      },
      select: { active: true },
    }),
    prisma.practitionerBranch.findUnique({
      where: {
        specialistOpenemrUuid_branchId: {
          specialistOpenemrUuid: input.specialistOpenemrUuid,
          branchId: input.branchId,
        },
      },
      select: { active: true },
    }),
  ]);

  const missing: string[] = [];
  if (!branchLink?.active) missing.push('service_not_offered_at_branch');
  if (!departmentLink?.active) missing.push('service_not_in_department');
  if (!practitionerLink?.active) missing.push('practitioner_not_assigned_to_branch');
  return missing;
}

function normalizeOfferingWrite(input: OfferingWrite) {
  return {
    specialistOpenemrUuid: input.specialistOpenemrUuid,
    serviceId: input.serviceId,
    departmentId: input.departmentId,
    branchId: input.branchId,
    active: input.active ?? true,
    publishedOnWeb: input.publishedOnWeb ?? true,
    allowAutoAssignment: input.allowAutoAssignment ?? true,
    allowPatientChoice: input.allowPatientChoice ?? true,
    assignmentPriority: input.assignmentPriority ?? 100,
    assignmentPriorityTier: input.assignmentPriorityTier ?? 'NORMAL',
    durationMinutes: input.durationMinutes ?? null,
    priceMinor: input.priceMinor ?? null,
    sortOrder: input.sortOrder ?? 0,
  };
}

/**
 * Copy a branch's offerings to another branch, reporting what could not come.
 *
 * Only combinations whose prerequisites already hold at the target are created;
 * the rest are returned as skips so the operator sees the difference before
 * deciding, rather than discovering later that half the roster silently moved.
 */
export async function copyPractitionerOfferingsBetweenBranches(
  fromBranchId: string,
  toBranchId: string,
  options: { dryRun?: boolean } = {},
): Promise<{ created: number; skipped: { offeringId: string; reasons: string[] }[] }> {
  const source = await prisma.practitionerOffering.findMany({
    where: { branchId: fromBranchId, active: true },
  });

  const creatable: ReturnType<typeof normalizeOfferingWrite>[] = [];
  const skipped: { offeringId: string; reasons: string[] }[] = [];

  for (const offering of source) {
    const target: OfferingWrite = {
      specialistOpenemrUuid: offering.specialistOpenemrUuid,
      serviceId: offering.serviceId,
      departmentId: offering.departmentId,
      branchId: toBranchId,
      allowAutoAssignment: offering.allowAutoAssignment,
      allowPatientChoice: offering.allowPatientChoice,
      assignmentPriority: offering.assignmentPriority,
      assignmentPriorityTier: offering.assignmentPriorityTier,
      // Overrides stay behind: a Hawally price is a statement about Hawally.
      sortOrder: offering.sortOrder,
    };
    const missing = await missingParentRelationships(target);
    if (missing.length > 0) {
      skipped.push({ offeringId: offering.id, reasons: missing });
      continue;
    }
    creatable.push(normalizeOfferingWrite(target));
  }

  if (!options.dryRun && creatable.length > 0) {
    await prisma.practitionerOffering.createMany({ data: creatable, skipDuplicates: true });
  }
  return { created: creatable.length, skipped };
}

/** Effective duration and price for one offering, resolving both override levels. */
export async function getEffectiveOfferingConfiguration(
  offeringId: string,
): Promise<EffectiveConfiguration | null> {
  const offering = await prisma.practitionerOffering.findUnique({
    where: { id: offeringId },
    include: { service: true },
  });
  if (!offering) return null;

  const branchLink = await prisma.serviceBranch.findUnique({
    where: { serviceId_branchId: { serviceId: offering.serviceId, branchId: offering.branchId } },
    select: { durationMinutes: true, priceMinor: true },
  });

  return resolveEffectiveConfiguration(
    { durationMinutes: offering.service.durationMinutes, priceMinor: offering.service.priceMinor },
    branchLink,
    { durationMinutes: offering.durationMinutes, priceMinor: offering.priceMinor },
  );
}

// ---------------------------------------------------------------------------
// OpenEMR mappings
// ---------------------------------------------------------------------------

/** Stable OpenEMR reference for a service — principally the appointment category. */
export async function getServiceOpenemrMapping(
  serviceId: string,
  entityType = 'appointment_category',
): Promise<string | null> {
  const row = await prisma.serviceOpenemrMapping.findUnique({
    where: { serviceId_entityType: { serviceId, entityType } },
    select: { externalId: true, active: true },
  });
  return row?.active ? row.externalId : null;
}

export function getDepartmentOpenemrMappings(departmentId: string) {
  return prisma.departmentOpenemrMapping.findMany({
    where: { departmentId, active: true },
  });
}

// ---------------------------------------------------------------------------
// Specialty mapping
// ---------------------------------------------------------------------------

/** Replace a department's specialty mapping, folding duplicates by normalized key. */
export async function setDepartmentSpecialties(
  departmentId: string,
  specialties: string[],
): Promise<void> {
  const byKey = new Map<string, string>();
  for (const raw of specialties) {
    const trimmed = raw.trim();
    if (trimmed) byKey.set(normalizeSpecialty(trimmed), trimmed);
  }

  await prisma.$transaction([
    prisma.departmentSpecialty.deleteMany({ where: { departmentId } }),
    prisma.departmentSpecialty.createMany({
      data: Array.from(byKey, ([specialtyKey, specialty]) => ({
        departmentId,
        specialty,
        specialtyKey,
      })),
    }),
  ]);
}

export { canSatisfySelectionMode };
