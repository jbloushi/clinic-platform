import type { BookingEntryPath, BookingHold } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getDataProvider } from '@/lib/data';
import { slotKey } from './patient-link';
import {
  rankAutoAssignmentCandidates,
  slotBuckets,
  type AssignmentCandidate,
  type RankedCandidate,
} from './assignment-engine';
import { listPractitionerOfferings, getEffectiveOfferingConfiguration } from './offering-repo';
import { validateOffering, canSatisfySelectionMode } from './offering-resolution';
import { getBookingCountsSince } from './platform-repo';

/**
 * Turns a ranked pool of doctors into a real, overlap-safe `BookingHold` row.
 *
 * `activeSlotKey` only rejects an identical start instant; `PractitionerSlotLock`
 * rows (one per quantum the appointment covers, see `slotBuckets`) are what
 * actually stop two holds from overlapping. Both are written in the same
 * transaction as the hold itself, so a partial write can never leave a slot
 * locked with no hold to explain it.
 */

async function getAssignmentSettings() {
  const settings = await prisma.assignmentSettings.findUnique({ where: { id: 'singleton' } });
  if (settings) return settings;
  // The migration seeds this row; a missing one is an unconfigured install,
  // not a normal runtime state — fall back rather than throw so booking still
  // works with sane defaults.
  return prisma.assignmentSettings.upsert({
    where: { id: 'singleton' },
    create: {},
    update: {},
  });
}

export type CreateHoldInput = {
  serviceId: string;
  branchId: string;
  startAt: Date;
  endAt: Date;
  patientIdentityId?: string;
  reason?: string;
  bookingEntryPath: BookingEntryPath;
  followUpFromBookingId?: string;
  /** Set when this hold replaces one moved by a reschedule — see reschedule.ts. */
  rescheduledFromBookingId?: string;
  previousPractitionerUuid?: string | null;
  isFollowUp?: boolean;
};

export type CreateHoldFailure =
  | { ok: false; reason: 'no_availability' }
  | { ok: false; reason: 'offering_invalid'; details: string[] };

export type CreateHoldSuccess = { ok: true; hold: BookingHold };
export type CreateHoldResult = CreateHoldSuccess | CreateHoldFailure;

/**
 * Rank the eligible auto-assignment pool for a service/branch, best doctor
 * first. Pure orchestration — the actual ordering logic lives in
 * `rankAutoAssignmentCandidates` (assignment-engine.ts), reused verbatim.
 */
export async function autoAssignPractitioner(
  input: Pick<CreateHoldInput, 'serviceId' | 'branchId' | 'previousPractitionerUuid' | 'isFollowUp'>,
): Promise<RankedCandidate[]> {
  const [settings, offerings] = await Promise.all([
    getAssignmentSettings(),
    listPractitionerOfferings({
      serviceId: input.serviceId,
      branchId: input.branchId,
      allowAutoAssignment: true,
      activeOnly: true,
      publishedOnly: true,
    }),
  ]);
  if (offerings.length === 0) return [];

  const since = new Date(Date.now() - settings.workloadWindowDays * 24 * 60 * 60 * 1000);
  const loadByUuid = await getBookingCountsSince(
    offerings.map((o) => o.specialistOpenemrUuid),
    since,
  );

  const candidates: AssignmentCandidate[] = offerings.map((offering) => ({
    specialistOpenemrUuid: offering.specialistOpenemrUuid,
    practitionerOfferingId: offering.id,
    assignmentPriority: offering.assignmentPriority,
    assignmentPriorityTier: offering.assignmentPriorityTier,
    activeLoad: loadByUuid.get(offering.specialistOpenemrUuid) ?? 0,
    lastAutoAssignedAt: offering.lastAutoAssignedAt,
  }));

  return rankAutoAssignmentCandidates(candidates, {
    rules: {
      preferPreviousPractitioner: settings.preferPreviousPractitioner,
      useLeastRecentlyAssigned: settings.useLeastRecentlyAssigned,
      allowBackupTier: settings.allowBackupTier,
    },
    previousPractitionerUuid: input.previousPractitionerUuid,
    isFollowUp: input.isFollowUp,
  });
}

/**
 * Try each ranked candidate in order until one wins the atomic reservation.
 *
 * A P2002 on `activeSlotKey` or a slot-lock bucket means someone else took
 * that doctor's time between ranking and writing — falls through to the next
 * candidate rather than failing the whole request. Only exhausting the pool
 * is a genuine "nothing available".
 */
export async function createAutoAssignedBookingHold(input: CreateHoldInput): Promise<CreateHoldResult> {
  const ranked = await autoAssignPractitioner(input);
  if (ranked.length === 0) return { ok: false, reason: 'no_availability' };

  const settings = await getAssignmentSettings();

  for (const candidate of ranked) {
    const hold = await tryCreateHold({
      input,
      settings,
      specialistOpenemrUuid: candidate.specialistOpenemrUuid,
      practitionerOfferingId: candidate.practitionerOfferingId,
      assignmentMode: 'AUTO',
      assignmentReason: candidate.reason,
      eligibleDoctorCount: ranked.length,
    });
    if (hold) return { ok: true, hold };
  }

  return { ok: false, reason: 'no_availability' };
}

/**
 * Reserve a specific, patient-chosen doctor for an offering.
 *
 * Validated with the same rules ops readiness checks use
 * (`validateOffering`/`canSatisfySelectionMode`) so a stale or crafted request
 * can't reserve a combination that looks bookable but isn't.
 */
export async function createPractitionerSelectedBookingHold(
  input: CreateHoldInput & { specialistOpenemrUuid: string; departmentId: string },
): Promise<CreateHoldResult> {
  const offering = await prisma.practitionerOffering.findUnique({
    where: {
      specialistOpenemrUuid_serviceId_departmentId_branchId: {
        specialistOpenemrUuid: input.specialistOpenemrUuid,
        serviceId: input.serviceId,
        departmentId: input.departmentId,
        branchId: input.branchId,
      },
    },
    include: { service: true, department: true, branch: true },
  });
  if (!offering) return { ok: false, reason: 'offering_invalid', details: ['offering_not_found'] };
  if (!offering.allowPatientChoice) {
    return { ok: false, reason: 'offering_invalid', details: ['offering_not_patient_selectable'] };
  }
  if (!canSatisfySelectionMode('PATIENT_CHOICE', [offering])) {
    return { ok: false, reason: 'offering_invalid', details: ['selection_mode_unsatisfiable'] };
  }

  const [practitionerBranch, practitioner] = await Promise.all([
    prisma.practitionerBranch.findUnique({
      where: {
        specialistOpenemrUuid_branchId: {
          specialistOpenemrUuid: input.specialistOpenemrUuid,
          branchId: input.branchId,
        },
      },
      select: { active: true },
    }),
    getDataProvider().getPractitionerById(input.specialistOpenemrUuid).catch(() => null),
  ]);

  const serviceBranch = await prisma.serviceBranch.findUnique({
    where: { serviceId_branchId: { serviceId: input.serviceId, branchId: input.branchId } },
    select: { active: true },
  });
  const serviceDepartment = await prisma.serviceDepartment.findUnique({
    where: { serviceId_departmentId: { serviceId: input.serviceId, departmentId: input.departmentId } },
    select: { active: true },
  });

  const failures = validateOffering({
    practitionerActiveInEmr: Boolean(practitioner?.active),
    practitionerAssignedToBranch: Boolean(practitionerBranch?.active),
    serviceActiveAtBranch: Boolean(serviceBranch?.active),
    serviceInDepartment: Boolean(serviceDepartment?.active),
    branchOperational: offering.branch.published,
    serviceOperational: offering.service.active,
    departmentOperational: offering.department.published,
    offeringActive: offering.active && offering.publishedOnWeb,
  });
  if (failures.length > 0) return { ok: false, reason: 'offering_invalid', details: failures };

  const settings = await getAssignmentSettings();
  const hold = await tryCreateHold({
    input,
    settings,
    specialistOpenemrUuid: input.specialistOpenemrUuid,
    practitionerOfferingId: offering.id,
    assignmentMode: 'PATIENT_SELECTED',
    assignmentReason: null,
    eligibleDoctorCount: 1,
  });
  if (!hold) return { ok: false, reason: 'no_availability' };
  return { ok: true, hold };
}

async function tryCreateHold(args: {
  input: CreateHoldInput;
  settings: Awaited<ReturnType<typeof getAssignmentSettings>>;
  specialistOpenemrUuid: string;
  practitionerOfferingId: string;
  assignmentMode: 'AUTO' | 'PATIENT_SELECTED';
  assignmentReason: string | null;
  eligibleDoctorCount: number;
}): Promise<BookingHold | null> {
  const { input, settings, specialistOpenemrUuid, practitionerOfferingId, assignmentMode, assignmentReason, eligibleDoctorCount } =
    args;

  // Snapshots are always derived from the offering that actually won, never
  // from a caller-supplied branch/department — a service that spans several
  // departments must not have its confirmation show whichever one the
  // request happened to name.
  const [config, offering] = await Promise.all([
    getEffectiveOfferingConfiguration(practitionerOfferingId),
    prisma.practitionerOffering.findUnique({
      where: { id: practitionerOfferingId },
      include: { service: true, department: true, branch: true },
    }),
  ]);
  if (!config || !offering) return null;

  const buckets = slotBuckets(input.startAt, input.endAt, settings.slotQuantumMinutes);
  if (buckets.length === 0) return null;

  const practitioner = await getDataProvider()
    .getPractitionerById(specialistOpenemrUuid)
    .catch(() => null);

  try {
    return await prisma.$transaction(async (tx) => {
      const hold = await tx.bookingHold.create({
        data: {
          patientIdentityId: input.patientIdentityId,
          practitionerOpenemrId: specialistOpenemrUuid,
          serviceId: input.serviceId,
          startAt: input.startAt,
          endAt: input.endAt,
          status: 'held',
          activeSlotKey: slotKey(specialistOpenemrUuid, input.startAt),
          reason: input.reason,
          holdExpiresAt: new Date(Date.now() + settings.holdDurationMinutes * 60_000),
          followUpFromBookingId: input.followUpFromBookingId,
          rescheduledFromBookingId: input.rescheduledFromBookingId,
          branchId: offering.branchId,
          openemrFacilityId: offering.branch.openemrFacilityId,
          assignmentMode,
          bookingEntryPath: input.bookingEntryPath,
          assignedAutomatically: assignmentMode === 'AUTO',
          assignmentReason,
          practitionerOfferingId,
          eligibleDoctorCount,
          serviceNameSnapshot: offering.service.name,
          departmentNameSnapshot: offering.department.nameEn,
          branchNameSnapshot: offering.branch.nameEn,
          practitionerNameSnapshot: practitioner
            ? `${practitioner.title} ${practitioner.firstName} ${practitioner.lastName}`.trim()
            : null,
          serviceDurationSnapshot: config.durationMinutes,
          servicePriceSnapshot: config.priceMinor,
        },
      });

      await tx.practitionerSlotLock.createMany({
        data: buckets.map((bucket) => ({
          holdId: hold.id,
          specialistOpenemrUuid,
          slotBucketUtc: bucket,
        })),
      });

      if (assignmentMode === 'AUTO') {
        await tx.practitionerOffering.update({
          where: { id: practitionerOfferingId },
          data: { lastAutoAssignedAt: new Date() },
        });
      }

      await tx.bookingChange.create({
        data: {
          bookingId: hold.id,
          type: assignmentMode === 'AUTO' ? 'AUTO_ASSIGNED' : 'HOLD_CREATED',
          newData: { assignmentMode, specialistOpenemrUuid, startAt: input.startAt, endAt: input.endAt },
        },
      });

      return hold;
    });
  } catch (e: any) {
    if (e?.code === 'P2002') return null; // slot taken between ranking and write — caller tries the next candidate
    throw e;
  }
}

/**
 * Release a hold's slot. Slot-lock rows don't cascade-delete on a status
 * update (only on hold-row deletion), so they're deleted explicitly here —
 * otherwise a cancelled hold would keep blocking its buckets forever.
 */
export async function releaseBookingHold(id: string, status: 'cancelled' | 'expired'): Promise<void> {
  await prisma.$transaction([
    prisma.practitionerSlotLock.deleteMany({ where: { holdId: id } }),
    prisma.bookingHold.update({ where: { id }, data: { status, activeSlotKey: null } }),
    prisma.bookingChange.create({
      data: { bookingId: id, type: status === 'cancelled' ? 'CANCELLED' : 'STATUS_CHANGED', newData: { status } },
    }),
  ]);
}
