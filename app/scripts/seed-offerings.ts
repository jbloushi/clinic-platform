/**
 * Test data for the booking-hold engine and the new patient journey UI.
 *
 * Ops CRUD screens for offerings/availability are deliberately out of scope
 * for this pass — without this script the new engine has zero
 * `PractitionerOffering` rows to auto-assign against (confirmed by the
 * `backfill:offerings` dry run) and zero `AvailabilityRule` rows, so every
 * doctor falls back to the generic default hours regardless of branch.
 *
 * Only creates offerings for services that already have a real department
 * link and a practitioner already assigned to the branch — it does not
 * invent those relationships (see offering-repo.ts's parent-relationship
 * gate), just states the doctor/service/branch combination on top of them.
 *
 * Run:
 *   npm run seed:offerings -- --dry-run
 *   npm run seed:offerings
 */
import { PrismaClient } from '@prisma/client';
import { createPractitionerOffering, OfferingParentError } from '../src/lib/data/offering-repo';
import { upsertAvailabilityRules } from '../src/lib/data/availability-repo';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

/** specialistUuid -> department slug it's qualified to offer, from mock/provider.ts's specialties. */
const PRACTITIONER_DEPARTMENT_SLUG: Record<string, string> = {
  'mock-practitioner-1': 'bariatric-surgery',
  'mock-practitioner-2': 'gastroenterology',
  'mock-practitioner-6': 'gastroenterology',
};

/** specialistUuid -> weekly hours to seed, branch-scoped where the doctor only works one site. */
const AVAILABILITY: Record<string, { branchSlug: string | null; weekday: number; startTime: string; endTime: string; slotMinutes: number }[]> = {
  'mock-practitioner-1': [
    // Works both branches on the same schedule — null branchId is the fallback.
    { branchSlug: null, weekday: 1, startTime: '09:00', endTime: '13:00', slotMinutes: 30 },
    { branchSlug: null, weekday: 2, startTime: '09:00', endTime: '13:00', slotMinutes: 30 },
    { branchSlug: null, weekday: 3, startTime: '09:00', endTime: '13:00', slotMinutes: 30 },
    { branchSlug: null, weekday: 4, startTime: '09:00', endTime: '13:00', slotMinutes: 30 },
  ],
  'mock-practitioner-2': [
    { branchSlug: 'hawally', weekday: 0, startTime: '10:00', endTime: '14:00', slotMinutes: 20 },
    { branchSlug: 'hawally', weekday: 1, startTime: '10:00', endTime: '14:00', slotMinutes: 20 },
    { branchSlug: 'hawally', weekday: 2, startTime: '10:00', endTime: '14:00', slotMinutes: 20 },
    { branchSlug: 'hawally', weekday: 3, startTime: '10:00', endTime: '14:00', slotMinutes: 20 },
    { branchSlug: 'hawally', weekday: 4, startTime: '10:00', endTime: '14:00', slotMinutes: 20 },
  ],
  'mock-practitioner-6': [
    { branchSlug: 'jahra', weekday: 0, startTime: '10:00', endTime: '14:00', slotMinutes: 20 },
    { branchSlug: 'jahra', weekday: 1, startTime: '10:00', endTime: '14:00', slotMinutes: 20 },
    { branchSlug: 'jahra', weekday: 2, startTime: '10:00', endTime: '14:00', slotMinutes: 20 },
    { branchSlug: 'jahra', weekday: 3, startTime: '10:00', endTime: '14:00', slotMinutes: 20 },
    { branchSlug: 'jahra', weekday: 4, startTime: '10:00', endTime: '14:00', slotMinutes: 20 },
  ],
};

async function seedOfferings() {
  const practitionerBranches = await prisma.practitionerBranch.findMany({ where: { active: true } });
  const branchesByUuid = new Map<string, string[]>();
  for (const row of practitionerBranches) {
    const arr = branchesByUuid.get(row.specialistOpenemrUuid) ?? [];
    arr.push(row.branchId);
    branchesByUuid.set(row.specialistOpenemrUuid, arr);
  }

  let created = 0;
  const skipped: string[] = [];

  for (const [uuid, deptSlug] of Object.entries(PRACTITIONER_DEPARTMENT_SLUG)) {
    const department = await prisma.department.findUnique({ where: { slug: deptSlug } });
    if (!department) {
      skipped.push(`No department "${deptSlug}" for ${uuid}.`);
      continue;
    }
    const services = await prisma.service.findMany({
      where: { departmentId: department.id, active: true },
    });
    const branchIds = branchesByUuid.get(uuid) ?? [];

    for (const branchId of branchIds) {
      for (const service of services) {
        const exists = await prisma.practitionerOffering.findUnique({
          where: {
            specialistOpenemrUuid_serviceId_departmentId_branchId: {
              specialistOpenemrUuid: uuid,
              serviceId: service.id,
              departmentId: department.id,
              branchId,
            },
          },
        });
        if (exists) continue;

        if (DRY_RUN) {
          created += 1;
          continue;
        }
        try {
          await createPractitionerOffering({
            specialistOpenemrUuid: uuid,
            serviceId: service.id,
            departmentId: department.id,
            branchId,
            allowAutoAssignment: true,
            allowPatientChoice: true,
          });
          created += 1;
        } catch (e) {
          if (e instanceof OfferingParentError) {
            skipped.push(`${uuid} / ${service.name} / ${branchId}: ${e.missing.join(', ')}`);
          } else {
            throw e;
          }
        }
      }
    }
  }

  console.log(`Offerings created: ${created}`);
  if (skipped.length > 0) {
    console.log('Skipped:');
    for (const line of skipped) console.log(`  · ${line}`);
  }
}

async function seedAvailability() {
  const branches = await prisma.branch.findMany({ select: { id: true, slug: true } });
  const branchIdBySlug = new Map(branches.map((b) => [b.slug, b.id]));

  for (const [uuid, rules] of Object.entries(AVAILABILITY)) {
    if (DRY_RUN) {
      console.log(`Would write ${rules.length} availability rule(s) for ${uuid}`);
      continue;
    }
    await upsertAvailabilityRules(
      uuid,
      rules.map((rule) => ({
        branchId: rule.branchSlug ? branchIdBySlug.get(rule.branchSlug) ?? null : null,
        dayOfWeek: rule.weekday,
        startTime: rule.startTime,
        endTime: rule.endTime,
        slotMinutes: rule.slotMinutes,
      })),
    );
    console.log(`Availability seeded for ${uuid}: ${rules.length} rule(s)`);
  }
}

async function main() {
  console.log(`Offering + availability seed${DRY_RUN ? ' (dry run)' : ''}\n`);
  await seedOfferings();
  await seedAvailability();

  const [offerings, availabilityRules, autoAssignable] = await Promise.all([
    prisma.practitionerOffering.count(),
    prisma.availabilityRule.count(),
    prisma.practitionerOffering.count({ where: { allowAutoAssignment: true, active: true } }),
  ]);
  console.log(`\nTotal offerings:     ${offerings}`);
  console.log(`Auto-assignable:     ${autoAssignable}`);
  console.log(`Availability rules:  ${availabilityRules}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
