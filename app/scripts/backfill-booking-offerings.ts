/**
 * Move the clinic onto the explicit offering model.
 *
 * The previous model expressed eligibility loosely: a service belonged to at
 * most one department, was implicitly available everywhere, and a doctor with
 * no branch rows was treated as working at all of them. The new model states
 * each combination explicitly, which is what makes "every patient-visible
 * option is really bookable" checkable rather than hoped for.
 *
 * What this script will NOT do, by design:
 *
 *  - assign every doctor to every branch;
 *  - assign every doctor to every service;
 *  - invent a primary department when a service has several candidates;
 *  - guess a branch for a historical booking that never recorded one.
 *
 * Each of those would produce a configuration that passes every check and is
 * wrong — a patient sent to the wrong site, or billed for a service the doctor
 * does not perform. Ambiguity is reported for a human to resolve instead.
 *
 * Run:
 *   npm run backfill:offerings -- --dry-run
 *   npm run backfill:offerings
 */
import { PrismaClient } from '@prisma/client';
import { normalizeSpecialty } from '../src/lib/data/specialty';
import { migrateAvailabilityBlob } from './migrate-availability-blob';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

type Report = {
  created: Record<string, number>;
  ambiguous: string[];
  blocking: string[];
};

const report: Report = { created: {}, ambiguous: [], blocking: [] };

function counted(key: string, n = 1) {
  report.created[key] = (report.created[key] ?? 0) + n;
}

/**
 * Service.departmentId was a single optional column; the join replaces it and
 * allows several. The existing value becomes the primary membership, which is
 * unambiguous precisely because there was only ever one.
 */
async function migrateServiceDepartments() {
  const services = await prisma.service.findMany({
    select: { id: true, name: true, departmentId: true },
  });

  for (const service of services) {
    const existing = await prisma.serviceDepartment.count({ where: { serviceId: service.id } });
    if (existing > 0) continue;

    if (!service.departmentId) {
      report.ambiguous.push(
        `Service "${service.name}" has no department. Assign one in /ops/services before publishing it.`,
      );
      continue;
    }

    if (!DRY_RUN) {
      await prisma.serviceDepartment.create({
        data: {
          serviceId: service.id,
          departmentId: service.departmentId,
          isPrimary: true,
          active: true,
        },
      });
    }
    counted('serviceDepartment');
  }
}

/**
 * There was no service/branch table: a service was implicitly offered wherever
 * it was active. Reproducing that exactly would publish everything everywhere,
 * so the previous behaviour is carried over as a starting point and reported,
 * rather than treated as a considered decision.
 */
async function migrateServiceBranches() {
  const [services, branches] = await Promise.all([
    prisma.service.findMany({ where: { active: true }, select: { id: true, name: true, branchId: true } }),
    prisma.branch.findMany({ select: { id: true, nameEn: true } }),
  ]);

  if (branches.length === 0) {
    report.blocking.push('No branches exist; services cannot be located.');
    return;
  }

  for (const service of services) {
    // A service already pinned to one branch keeps that restriction.
    const targets = service.branchId ? branches.filter((b) => b.id === service.branchId) : branches;

    for (const branch of targets) {
      const existing = await prisma.serviceBranch.findUnique({
        where: { serviceId_branchId: { serviceId: service.id, branchId: branch.id } },
      });
      if (existing) continue;

      if (!DRY_RUN) {
        await prisma.serviceBranch.create({
          data: { serviceId: service.id, branchId: branch.id, active: true, publishedOnWeb: true },
        });
      }
      counted('serviceBranch');
    }
  }

  if (!service_branch_reviewed(services.length, branches.length)) {
    report.ambiguous.push(
      `Carried ${services.length} service(s) across ${branches.length} branch(es) from the previous "available everywhere" behaviour. Review /ops/branches and unpublish anything a branch does not actually offer.`,
    );
  }
}

function service_branch_reviewed(services: number, branches: number): boolean {
  // Nothing to review only when there is a single branch, where "everywhere"
  // and "here" are the same statement.
  return branches <= 1 || services === 0;
}

/**
 * The old convention was "no rows means every branch". That inverts here, so
 * every doctor who was implicitly bookable must be named explicitly — and the
 * script refuses to guess which branches those are.
 */
async function checkPractitionerBranches() {
  const links = await prisma.practitionerBranch.count({ where: { active: true } });
  const distinct = await prisma.practitionerBranch.findMany({
    where: { active: true },
    distinct: ['specialistOpenemrUuid'],
    select: { specialistOpenemrUuid: true },
  });

  counted('practitionerBranch', 0);
  report.created.practitionerBranchExisting = links;

  if (distinct.length === 0) {
    report.blocking.push(
      'No doctor is assigned to any branch. Under the explicit model this means nobody is publicly bookable — assign doctors in /ops/branches before enabling branch filtering.',
    );
  }
}

/**
 * Availability moves from a JSON blob on an AuditLog row into real rows, so it
 * can be queried, indexed and scoped per branch. The actual migration logic
 * lives in `migrate-availability-blob.ts` (also runnable standalone) — this
 * just runs it and folds the result into this script's own report.
 */
async function migrateAvailability() {
  const result = await migrateAvailabilityBlob({ dryRun: DRY_RUN, prismaClient: prisma });
  counted('availabilityRule', result.rulesCreated);
  for (const target of result.unreadable) {
    report.ambiguous.push(`Unreadable availability for practitioner ${target}; re-enter it in /ops/availability.`);
  }
}

/**
 * ServiceSpecialist said which doctors could perform a service, globally. That
 * is three of the four values an offering needs; the branch and department come
 * from the service's own memberships, and only unambiguous cases are created.
 */
async function deriveOfferings() {
  const links = await prisma.serviceSpecialist.findMany();
  if (links.length === 0) {
    report.ambiguous.push(
      'No service/specialist links exist to derive offerings from. Create offerings in /ops/offerings — they are not inferred from branch and department membership.',
    );
    return;
  }

  for (const link of links) {
    const [departments, branches] = await Promise.all([
      prisma.serviceDepartment.findMany({
        where: { serviceId: link.serviceId, active: true },
        select: { departmentId: true, isPrimary: true },
      }),
      prisma.serviceBranch.findMany({
        where: { serviceId: link.serviceId, active: true },
        select: { branchId: true },
      }),
    ]);

    const primary = departments.find((d) => d.isPrimary) ?? departments[0];
    if (!primary) {
      report.ambiguous.push(
        `Cannot derive an offering for service ${link.serviceId}: it has no department.`,
      );
      continue;
    }

    for (const branch of branches) {
      // The doctor must already be assigned to the branch. This is the check
      // that stops the backfill from quietly making everyone bookable
      // everywhere, which is the exact failure the explicit model exists to
      // prevent.
      const assigned = await prisma.practitionerBranch.findUnique({
        where: {
          specialistOpenemrUuid_branchId: {
            specialistOpenemrUuid: link.specialistOpenemrUuid,
            branchId: branch.branchId,
          },
        },
        select: { active: true },
      });
      if (!assigned?.active) {
        report.ambiguous.push(
          `Skipped offering for ${link.specialistOpenemrUuid} at branch ${branch.branchId}: the doctor is not assigned there.`,
        );
        continue;
      }

      const exists = await prisma.practitionerOffering.findUnique({
        where: {
          specialistOpenemrUuid_serviceId_departmentId_branchId: {
            specialistOpenemrUuid: link.specialistOpenemrUuid,
            serviceId: link.serviceId,
            departmentId: primary.departmentId,
            branchId: branch.branchId,
          },
        },
      });
      if (exists) continue;

      if (!DRY_RUN) {
        await prisma.practitionerOffering.create({
          data: {
            specialistOpenemrUuid: link.specialistOpenemrUuid,
            serviceId: link.serviceId,
            departmentId: primary.departmentId,
            branchId: branch.branchId,
            active: true,
            publishedOnWeb: true,
          },
        });
      }
      counted('practitionerOffering');
    }
  }
}

/** Re-fold specialty keys through the shared normalizer. */
async function renormalizeSpecialties() {
  const rows = await prisma.departmentSpecialty.findMany();
  for (const row of rows) {
    const key = normalizeSpecialty(row.specialty);
    if (key === row.specialtyKey) continue;
    if (!DRY_RUN) {
      await prisma.departmentSpecialty
        .update({ where: { id: row.id }, data: { specialtyKey: key } })
        .catch(() => {
          report.ambiguous.push(
            `Specialty "${row.specialty}" normalises onto another mapping in the same department; remove the duplicate in /ops/departments.`,
          );
        });
    }
    counted('specialtyRenormalised');
  }
}

/** Services still writing the fixed env appointment category. */
async function reportMissingServiceMappings() {
  const missing = await prisma.service.count({
    where: { active: true, openemrMappings: { none: { active: true } } },
  });
  if (missing > 0) {
    report.ambiguous.push(
      `${missing} active service(s) have no OpenEMR appointment category. Their bookings are filed under the default category rather than the service booked. Map them in /ops/services.`,
    );
  }
}

async function reportPublishedReadiness() {
  const branches = await prisma.branch.findMany({ where: { published: true } });
  for (const branch of branches) {
    const [offerings, facility] = await Promise.all([
      prisma.practitionerOffering.count({
        where: { branchId: branch.id, active: true, publishedOnWeb: true },
      }),
      Promise.resolve(branch.openemrFacilityId),
    ]);
    if (facility == null) {
      report.blocking.push(`Published branch "${branch.nameEn}" has no OpenEMR facility linked.`);
    }
    if (offerings === 0) {
      report.blocking.push(
        `Published branch "${branch.nameEn}" has no offerings, so it shows a bookable clinic with no obtainable appointment.`,
      );
    }
  }
}

async function main() {
  console.log(`Clinic booking backfill${DRY_RUN ? ' (dry run — nothing will be written)' : ''}\n`);

  await migrateServiceDepartments();
  await migrateServiceBranches();
  await checkPractitionerBranches();
  await migrateAvailability();
  await deriveOfferings();
  await renormalizeSpecialties();
  await reportMissingServiceMappings();
  await reportPublishedReadiness();

  const [departments, services, branches, offerings, autoAssignable, patientSelectable] =
    await Promise.all([
      prisma.department.count(),
      prisma.service.count(),
      prisma.branch.count(),
      prisma.practitionerOffering.count(),
      prisma.practitionerOffering.count({ where: { allowAutoAssignment: true, active: true } }),
      prisma.practitionerOffering.count({ where: { allowPatientChoice: true, active: true } }),
    ]);

  console.log(`Departments:                    ${departments}`);
  console.log(`Services:                       ${services}`);
  console.log(`Branches:                       ${branches}`);
  console.log('');
  console.log(`Service-department links added: ${report.created.serviceDepartment ?? 0}`);
  console.log(`Service-branch links added:     ${report.created.serviceBranch ?? 0}`);
  console.log(`Practitioner-branch links:      ${report.created.practitionerBranchExisting ?? 0} (existing)`);
  console.log(`Availability rules migrated:    ${report.created.availabilityRule ?? 0}`);
  console.log(`Practitioner offerings added:   ${report.created.practitionerOffering ?? 0}`);
  console.log(`Specialties renormalised:       ${report.created.specialtyRenormalised ?? 0}`);
  console.log('');
  console.log(`Total offerings:                ${offerings}`);
  console.log(`Auto-assignable offerings:      ${autoAssignable}`);
  console.log(`Patient-selectable offerings:   ${patientSelectable}`);

  if (report.ambiguous.length > 0) {
    console.log('\nNeeds review:');
    for (const line of report.ambiguous) console.log(`  · ${line}`);
  }

  if (report.blocking.length > 0) {
    console.log('\nBlocking — published configuration is not bookable:');
    for (const line of report.blocking) console.log(`  ✗ ${line}`);
    console.log('\nResolve these before enabling the booking journey.');
    process.exitCode = 1;
    return;
  }

  console.log(DRY_RUN ? '\nDry run complete. Re-run without --dry-run to apply.' : '\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
