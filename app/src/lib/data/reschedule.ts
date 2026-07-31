import type { BookingHold } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getDataProvider } from '@/lib/data';
import {
  createAutoAssignedBookingHold,
  createPractitionerSelectedBookingHold,
  type CreateHoldResult,
} from './booking-hold-engine';
import { finalizeBooking } from './finalization';

/**
 * Branch/doctor/service-changing reschedule for holds created by the new
 * engine — the old `PATCH /api/bookings/[id]/route.ts` reschedule endpoint
 * stays untouched (same-doctor, same-branch, same-service only, per the
 * original plan's decision) since it still serves the old booking model.
 *
 * This is a genuinely different operation from that endpoint, not an
 * extension of it: any of branch, service, or doctor may change, so "the new
 * appointment" is resolved through the same `booking-hold-engine.ts` used for
 * a first-time booking (full offering validation, atomic slot locking,
 * auto-assignment ranking if no doctor is named) rather than a narrower
 * same-doctor availability check.
 *
 * Ordering is deliberately create-then-cancel, not cancel-then-create: the
 * old route cancels first to avoid a self-collision on the doctor+time unique
 * index, which means a failed re-book leaves the patient with nothing. Here
 * the new hold has to exist before the old one is touched, so a failure
 * (no availability, invalid offering) leaves the original booking completely
 * unaffected. The only case this reintroduces a self-collision is an
 * unchanged doctor at the exact same instant, which is treated as a no-op
 * before either hold is touched.
 */

export type RescheduleInput = {
  currentHoldId: string;
  /** Omit to keep the current branch. */
  branchId?: string;
  /** Omit to keep the current service. */
  serviceId?: string;
  /** Required whenever `specialistOpenemrUuid` names a doctor (own department may also change with the service). */
  departmentId?: string;
  /**
   * `undefined` = keep the current doctor (re-validated against the possibly
   * new branch/service — this can fail, e.g. the doctor isn't offered there).
   * `null` = auto-reassign. A string = pick this specific doctor.
   */
  specialistOpenemrUuid?: string | null;
  startAt: Date;
  endAt: Date;
  reason?: string;
  /** Who requested it — "patient:<id>" or "staff:<id>", for the audit trail. */
  actor: string;
};

export type RescheduleResult =
  | { ok: true; hold: BookingHold; paymentRequired: boolean }
  | { ok: false; reason: 'hold_not_found' }
  | { ok: false; reason: 'hold_not_active'; status: string }
  | { ok: false; reason: 'start_in_past' }
  | { ok: false; reason: 'no_op' }
  | { ok: false; reason: 'no_availability' }
  | { ok: false; reason: 'offering_invalid'; details: string[] };

const RESCHEDULABLE = new Set(['held', 'pending_payment', 'confirmed']);

export async function rescheduleBookingHold(input: RescheduleInput): Promise<RescheduleResult> {
  const current = await prisma.bookingHold.findUnique({ where: { id: input.currentHoldId } });
  if (!current) return { ok: false, reason: 'hold_not_found' };
  if (!RESCHEDULABLE.has(current.status)) {
    return { ok: false, reason: 'hold_not_active', status: current.status };
  }
  if (input.startAt < new Date()) return { ok: false, reason: 'start_in_past' };

  const targetBranchId = input.branchId ?? current.branchId;
  const targetServiceId = input.serviceId ?? current.serviceId;
  if (!targetBranchId) return { ok: false, reason: 'offering_invalid', details: ['no_branch'] };

  const branchChanged = targetBranchId !== current.branchId;
  const serviceChanged = targetServiceId !== current.serviceId;

  // A true no-op (same doctor, same everything, same instant) would
  // self-collide on the unique slot key if we tried to create it before
  // releasing the original — short-circuit instead of routing it through the
  // engine at all.
  const keepingSameDoctor = input.specialistOpenemrUuid === undefined;
  if (
    keepingSameDoctor &&
    !branchChanged &&
    !serviceChanged &&
    input.startAt.getTime() === current.startAt.getTime() &&
    input.endAt.getTime() === current.endAt.getTime()
  ) {
    return { ok: false, reason: 'no_op' };
  }

  const engineInput = {
    serviceId: targetServiceId,
    branchId: targetBranchId,
    startAt: input.startAt,
    endAt: input.endAt,
    patientIdentityId: current.patientIdentityId ?? undefined,
    reason: input.reason ?? current.reason ?? undefined,
    bookingEntryPath: current.bookingEntryPath ?? 'SERVICE_PATH',
    rescheduledFromBookingId: current.id,
  };

  let result: CreateHoldResult;
  if (input.specialistOpenemrUuid === null) {
    result = await createAutoAssignedBookingHold(engineInput);
  } else {
    const specialistOpenemrUuid = input.specialistOpenemrUuid ?? current.practitionerOpenemrId;
    const departmentId = await resolveDepartmentId(input.departmentId, targetServiceId, specialistOpenemrUuid, targetBranchId);
    if (!departmentId) {
      return { ok: false, reason: 'offering_invalid', details: ['no_matching_offering'] };
    }
    result = await createPractitionerSelectedBookingHold({
      ...engineInput,
      specialistOpenemrUuid,
      departmentId,
    });
  }

  if (!result.ok) return result;
  const newHold = result.hold;

  const doctorChanged = newHold.practitionerOpenemrId !== current.practitionerOpenemrId;

  // The original hold is only ever touched after the replacement exists.
  await cancelSupersededHold(current, newHold.id, { branchChanged, doctorChanged, serviceChanged });

  if (current.openemrAppointmentId) {
    await getDataProvider().updateAppointmentStatus(current.openemrAppointmentId, 'cancelled').catch(() => {});
  }

  await prisma.bookingChange.create({
    data: {
      bookingId: newHold.id,
      type: 'RESCHEDULED',
      changedById: input.actor,
      newData: { rescheduledFromBookingId: current.id, branchChanged, doctorChanged, serviceChanged },
    },
  });

  const wasPaid = current.status === 'confirmed';
  const samePriceAsBefore = newHold.servicePriceSnapshot === current.servicePriceSnapshot;

  if (wasPaid && samePriceAsBefore) {
    // No new charge: the price didn't move, so the existing payment still
    // covers it. Re-pointing it keeps one payment history per visit instead
    // of an orphaned one on a cancelled hold and an unexplained gap on the
    // new. A cash payment still counts as "already committed" even while its
    // own status is `pending` (owed at reception, not online) — that's the
    // same rule `finalizeBooking` itself uses to treat a cash hold as paid.
    const payment = await prisma.payment.findFirst({
      where: { bookingHoldId: current.id, OR: [{ status: 'succeeded' }, { method: 'cash' }] },
      orderBy: { createdAt: 'desc' },
    });
    if (payment) {
      await prisma.payment.update({ where: { id: payment.id }, data: { bookingHoldId: newHold.id } });
      const finalized = await finalizeBooking(newHold.id);
      // Only report "no charge needed" when finalization genuinely went
      // through — if it didn't (e.g. an EMR hiccup), the new hold still
      // needs the normal payment/finalize flow, same as any other case.
      if (finalized.ok) {
        return { ok: true, hold: finalized.hold, paymentRequired: false };
      }
    }
  }

  // Either nothing was paid yet, or the price changed — the old payment (if
  // any) stays attached to the now-cancelled original hold as a historical
  // record, and the new hold goes through the normal finalize/payment flow
  // for whatever it now costs. No partial-difference billing is attempted.
  return { ok: true, hold: newHold, paymentRequired: true };
}

/**
 * Cancel the hold being replaced: release its slot locks, mark it cancelled,
 * and record why — distinct `BookingChange` types per what actually moved, so
 * the audit trail says more than "cancelled".
 */
async function cancelSupersededHold(
  hold: BookingHold,
  newHoldId: string,
  flags: { branchChanged: boolean; doctorChanged: boolean; serviceChanged: boolean },
): Promise<void> {
  const changeTypes: ('BRANCH_CHANGED' | 'PRACTITIONER_CHANGED' | 'SERVICE_CHANGED')[] = [];
  if (flags.branchChanged) changeTypes.push('BRANCH_CHANGED');
  if (flags.doctorChanged) changeTypes.push('PRACTITIONER_CHANGED');
  if (flags.serviceChanged) changeTypes.push('SERVICE_CHANGED');

  await prisma.$transaction([
    prisma.practitionerSlotLock.deleteMany({ where: { holdId: hold.id } }),
    prisma.bookingHold.update({ where: { id: hold.id }, data: { status: 'cancelled', activeSlotKey: null } }),
    prisma.bookingChange.create({
      data: {
        bookingId: hold.id,
        type: 'RESCHEDULED',
        newData: { supersededBy: newHoldId, ...flags },
      },
    }),
    ...changeTypes.map((type) =>
      prisma.bookingChange.create({ data: { bookingId: hold.id, type, newData: { supersededBy: newHoldId } } }),
    ),
  ]);
}

/**
 * Resolve which department a named-doctor reschedule should book under.
 *
 * A reschedule request only ever names a service, not a department — the
 * caller shouldn't have to know which department an offering happens to sit
 * under. If exactly one active, published offering matches
 * doctor+service+branch, that offering's department is used; an explicit
 * `departmentId` (when the caller does know it) is honoured as-is without
 * this lookup.
 */
async function resolveDepartmentId(
  explicitDepartmentId: string | undefined,
  serviceId: string,
  specialistOpenemrUuid: string,
  branchId: string,
): Promise<string | null> {
  if (explicitDepartmentId) return explicitDepartmentId;
  const offering = await prisma.practitionerOffering.findFirst({
    where: { serviceId, specialistOpenemrUuid, branchId, active: true, publishedOnWeb: true },
    select: { departmentId: true },
  });
  return offering?.departmentId ?? null;
}
