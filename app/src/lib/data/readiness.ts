import { prisma } from '@/lib/db';
import { canSatisfySelectionMode } from './offering-resolution';

/**
 * One place that decides whether something is genuinely bookable.
 *
 * Publication state on its own is a claim, not a fact: a service can be active,
 * published, priced and mapped and still have no doctor who performs it at the
 * branch a patient is looking at. Readiness is the difference between "someone
 * ticked publish" and "a patient can complete a booking", and it is centralised
 * so the public pages, the ops health dashboard and the backfill all answer the
 * question the same way.
 */

export type ReadinessIssue = {
  code: string;
  /** Sentence shown to staff — states what is wrong and what it prevents. */
  message: string;
  /** Where to go and fix it. */
  fixHref?: string;
};

export type ReadinessResult = {
  ready: boolean;
  issues: ReadinessIssue[];
};

function result(issues: ReadinessIssue[]): ReadinessResult {
  return { ready: issues.length === 0, issues };
}

/**
 * A branch is ready when a patient choosing it can reach a real appointment:
 * it resolves to an OpenEMR facility, offers something, and has someone to
 * provide it.
 */
export async function evaluateBranchReadiness(branchId: string): Promise<ReadinessResult> {
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) return result([{ code: 'not_found', message: 'Branch no longer exists.' }]);

  const issues: ReadinessIssue[] = [];

  if (branch.openemrFacilityId == null) {
    issues.push({
      code: 'no_facility',
      message:
        'No OpenEMR facility is linked, so appointments booked here could not be recorded at the right location.',
      fixHref: `/ops/branches/${branchId}`,
    });
  }

  const [services, practitioners, offerings] = await Promise.all([
    prisma.serviceBranch.count({ where: { branchId, active: true, publishedOnWeb: true } }),
    prisma.practitionerBranch.count({ where: { branchId, active: true } }),
    prisma.practitionerOffering.count({ where: { branchId, active: true, publishedOnWeb: true } }),
  ]);

  if (services === 0) {
    issues.push({
      code: 'no_services',
      message: 'No services are published at this branch, so it has nothing to book.',
      fixHref: `/ops/branches/${branchId}`,
    });
  }
  if (practitioners === 0) {
    issues.push({
      code: 'no_practitioners',
      message: 'No doctors are assigned to this branch, so nobody can be booked here.',
      fixHref: `/ops/branches/${branchId}`,
    });
  }
  if (offerings === 0) {
    issues.push({
      code: 'no_offerings',
      message:
        'No doctor offers any service here. Assigning doctors and services separately is not enough — each combination must be stated.',
      fixHref: `/ops/offerings?branch=${branchId}`,
    });
  }

  // A service set to automatic assignment with nobody auto-assignable looks
  // configured and produces a booking page with no obtainable appointment.
  const branchServices = await prisma.serviceBranch.findMany({
    where: { branchId, active: true, publishedOnWeb: true },
    include: { service: { select: { id: true, name: true } } },
  });
  for (const link of branchServices) {
    const capabilities = await prisma.practitionerOffering.findMany({
      where: { branchId, serviceId: link.serviceId, active: true, publishedOnWeb: true },
      select: { allowAutoAssignment: true, allowPatientChoice: true },
    });
    if (!canSatisfySelectionMode(link.practitionerSelectionMode, capabilities)) {
      issues.push({
        code: 'selection_mode_unsatisfiable',
        message: `${link.service.name} is set to ${humanMode(link.practitionerSelectionMode)}, but no offering here supports it.`,
        fixHref: `/ops/offerings?branch=${branchId}&service=${link.serviceId}`,
      });
    }
  }

  return result(issues);
}

/** A service is ready when it is priced, categorised, located and staffed. */
export async function evaluateServiceReadiness(serviceId: string): Promise<ReadinessResult> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { departmentLinks: true, branchLinks: true },
  });
  if (!service) return result([{ code: 'not_found', message: 'Service no longer exists.' }]);

  const issues: ReadinessIssue[] = [];
  const activeDepartments = service.departmentLinks.filter((link) => link.active);
  const primaries = activeDepartments.filter((link) => link.isPrimary);

  if (activeDepartments.length === 0) {
    issues.push({
      code: 'no_department',
      message: 'Not in any department, so it cannot be browsed to.',
      fixHref: `/ops/services/${serviceId}`,
    });
  } else if (primaries.length !== 1) {
    issues.push({
      code: 'primary_department',
      message: `Needs exactly one primary department; it has ${primaries.length}. The primary one supplies the breadcrumb, search label and reporting category.`,
      fixHref: `/ops/services/${serviceId}`,
    });
  }

  if (service.branchLinks.filter((link) => link.active).length === 0) {
    issues.push({
      code: 'no_branch',
      message: 'Not offered at any branch, so no patient can reach it.',
      fixHref: `/ops/services/${serviceId}`,
    });
  }

  const [offerings, mapping] = await Promise.all([
    prisma.practitionerOffering.count({ where: { serviceId, active: true, publishedOnWeb: true } }),
    prisma.serviceOpenemrMapping.findUnique({
      where: { serviceId_entityType: { serviceId, entityType: 'appointment_category' } },
      select: { active: true },
    }),
  ]);

  if (offerings === 0) {
    issues.push({
      code: 'no_offerings',
      message: 'No doctor offers this service anywhere.',
      fixHref: `/ops/offerings?service=${serviceId}`,
    });
  }
  if (!mapping?.active) {
    issues.push({
      code: 'no_openemr_category',
      message:
        'No OpenEMR appointment category is mapped, so bookings would be filed under the default category rather than this service.',
      fixHref: `/ops/services/${serviceId}`,
    });
  }

  return result(issues);
}

/** A department is ready when it leads somewhere bookable. */
export async function evaluateDepartmentReadiness(departmentId: string): Promise<ReadinessResult> {
  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) return result([{ code: 'not_found', message: 'Department no longer exists.' }]);

  const issues: ReadinessIssue[] = [];
  const [services, offerings, specialties] = await Promise.all([
    prisma.serviceDepartment.count({ where: { departmentId, active: true } }),
    prisma.practitionerOffering.count({
      where: { departmentId, active: true, publishedOnWeb: true },
    }),
    prisma.departmentSpecialty.count({ where: { departmentId } }),
  ]);

  if (services === 0) {
    issues.push({
      code: 'no_services',
      message: 'No services belong to this department.',
      fixHref: `/ops/departments/${departmentId}`,
    });
  }
  if (offerings === 0) {
    issues.push({
      code: 'no_offerings',
      message: 'No doctor offers a service under this department.',
      fixHref: `/ops/offerings?department=${departmentId}`,
    });
  }
  if (specialties === 0) {
    issues.push({
      code: 'no_specialties',
      message:
        'No OpenEMR specialty is mapped, so the department cannot list doctors for patient discovery.',
      fixHref: `/ops/departments/${departmentId}`,
    });
  }

  return result(issues);
}

/** A doctor is ready when they are assigned, offering something, and available. */
export async function evaluatePractitionerReadiness(uuid: string): Promise<ReadinessResult> {
  const issues: ReadinessIssue[] = [];

  const [branches, offerings, availability] = await Promise.all([
    prisma.practitionerBranch.count({ where: { specialistOpenemrUuid: uuid, active: true } }),
    prisma.practitionerOffering.count({
      where: { specialistOpenemrUuid: uuid, active: true, publishedOnWeb: true },
    }),
    prisma.availabilityRule.count({ where: { specialistOpenemrUuid: uuid, active: true } }),
  ]);

  if (branches === 0) {
    issues.push({
      code: 'no_branch',
      message: 'Not bookable: no branch assigned.',
      fixHref: `/ops/providers/${uuid}`,
    });
  }
  if (offerings === 0) {
    issues.push({
      code: 'no_offerings',
      message: 'Offers no service, so cannot be booked even where assigned.',
      fixHref: `/ops/providers/${uuid}`,
    });
  }
  if (availability === 0) {
    issues.push({
      code: 'no_availability',
      message: 'No availability recorded, so every offering produces an empty calendar.',
      fixHref: `/ops/availability?practitioner=${uuid}`,
    });
  }

  return result(issues);
}

/**
 * Counts behind the reference-data health dashboard.
 *
 * Each figure names a specific way the configuration can be wrong while still
 * looking finished, which is the class of fault this dashboard exists to find.
 */
export async function getReferenceDataHealth() {
  const [
    departments,
    services,
    branches,
    serviceDepartments,
    serviceBranches,
    practitionerBranches,
    offerings,
    autoAssignable,
    patientSelectable,
    servicesWithoutBranch,
    servicesWithoutDepartment,
    servicesWithoutCategory,
    branchesWithoutFacility,
    unmappedSpecialties,
    failedFinalizations,
  ] = await Promise.all([
    prisma.department.count(),
    prisma.service.count(),
    prisma.branch.count(),
    prisma.serviceDepartment.count({ where: { active: true } }),
    prisma.serviceBranch.count({ where: { active: true } }),
    prisma.practitionerBranch.count({ where: { active: true } }),
    prisma.practitionerOffering.count({ where: { active: true } }),
    prisma.practitionerOffering.count({ where: { active: true, allowAutoAssignment: true } }),
    prisma.practitionerOffering.count({ where: { active: true, allowPatientChoice: true } }),
    prisma.service.count({ where: { active: true, branchLinks: { none: { active: true } } } }),
    prisma.service.count({ where: { active: true, departmentLinks: { none: { active: true } } } }),
    prisma.service.count({ where: { active: true, openemrMappings: { none: { active: true } } } }),
    prisma.branch.count({ where: { openemrFacilityId: null } }),
    prisma.departmentSpecialty.count(),
    prisma.bookingHold.count({ where: { status: 'finalization_failed' } }),
  ]);

  return {
    departments,
    services,
    branches,
    serviceDepartments,
    serviceBranches,
    practitionerBranches,
    offerings,
    autoAssignable,
    patientSelectable,
    servicesWithoutBranch,
    servicesWithoutDepartment,
    servicesWithoutCategory,
    branchesWithoutFacility,
    mappedSpecialties: unmappedSpecialties,
    failedFinalizations,
  };
}

function humanMode(mode: string): string {
  switch (mode) {
    case 'AUTO':
      return 'first available doctor only';
    case 'PATIENT_CHOICE':
      return 'patient must choose a doctor';
    case 'AUTO_OR_PATIENT_CHOICE':
      return 'first available or choose a doctor';
    default:
      return mode;
  }
}
