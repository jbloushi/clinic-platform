/**
 * One-time migration: availability moves from a JSON blob on an `AuditLog`
 * row into real `AvailabilityRule` rows, so it can be queried, indexed and
 * scoped per branch — the JSON blob had none of that.
 *
 * Idempotent: does nothing if any `AvailabilityRule` row already exists
 * (whether from a previous run of this script or from real writes since).
 * Never deletes the source `AuditLog` rows — they stay as a paper trail even
 * after the data they describe has a real home.
 *
 * Also exported as `migrateAvailabilityBlob()` so
 * `backfill-booking-offerings.ts` can run the exact same logic as part of its
 * broader pass, rather than keeping a second copy in sync by hand.
 *
 * Run:
 *   npm run migrate:availability -- --dry-run
 *   npm run migrate:availability
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Legacy availability shape, as written by `setPractitionerAvailability` in platform-repo.ts. */
type LegacyRule = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes?: number;
  branchId?: string;
};

export type MigrationReport = {
  practitionersSeen: number;
  rulesCreated: number;
  unreadable: string[];
};

export async function migrateAvailabilityBlob(opts: { dryRun?: boolean; prismaClient?: PrismaClient } = {}): Promise<MigrationReport> {
  const db = opts.prismaClient ?? prisma;
  const report: MigrationReport = { practitionersSeen: 0, rulesCreated: 0, unreadable: [] };

  const existing = await db.availabilityRule.count();
  if (existing > 0) return report; // already migrated (or real rows exist) — nothing to do

  const blobs = await db.auditLog.findMany({
    where: { action: 'practitioner.availability.set' },
    orderBy: { createdAt: 'desc' },
  });

  const seen = new Set<string>();
  for (const row of blobs) {
    // Only the newest blob per practitioner reflects their current schedule.
    if (!row.target || seen.has(row.target)) continue;
    seen.add(row.target);
    report.practitionersSeen += 1;

    let rules: LegacyRule[];
    try {
      rules = JSON.parse(row.metadata ?? '[]');
    } catch {
      report.unreadable.push(row.target);
      continue;
    }
    if (!Array.isArray(rules)) continue;

    for (const rule of rules) {
      if (!opts.dryRun) {
        await db.availabilityRule.create({
          data: {
            specialistOpenemrUuid: row.target,
            branchId: rule.branchId ?? null,
            weekday: rule.dayOfWeek,
            startTime: rule.startTime,
            endTime: rule.endTime,
            slotMinutes: rule.slotMinutes ?? 20,
            active: true,
          },
        });
      }
      report.rulesCreated += 1;
    }
  }

  return report;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`Availability blob migration${dryRun ? ' (dry run — nothing will be written)' : ''}\n`);

  const report = await migrateAvailabilityBlob({ dryRun });

  console.log(`Practitioners with a legacy blob: ${report.practitionersSeen}`);
  console.log(`Availability rules ${dryRun ? 'that would be created' : 'created'}: ${report.rulesCreated}`);
  if (report.unreadable.length > 0) {
    console.log(`\nUnreadable blobs (re-enter manually):`);
    for (const target of report.unreadable) console.log(`  · ${target}`);
  }
  console.log(dryRun ? '\nDry run complete. Re-run without --dry-run to apply.' : '\nDone.');
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
