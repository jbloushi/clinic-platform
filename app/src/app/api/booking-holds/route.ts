import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { getBranchById } from '@/lib/data/reference-repo';
import {
  createAutoAssignedBookingHold,
  createPractitionerSelectedBookingHold,
} from '@/lib/data/booking-hold-engine';

/**
 * Create a real, overlap-safe `BookingHold` for either patient journey.
 *
 * `specialistOpenemrUuid` present → doctor-path (patient-selected offering).
 * Absent → service-path (auto-assignment ranks the eligible pool and reserves
 * the best available candidate). Both converge on the same engine
 * (`booking-hold-engine.ts`), so this route is only request validation and
 * translation — no assignment or locking logic lives here.
 */
const bodySchema = z
  .object({
    serviceId: z.string().min(1),
    branchId: z.string().min(1),
    // Only meaningful (and only required) for a doctor-path pick — the
    // composite key that names one specific offering. Auto-assignment ranks
    // across every department that offers the service, so it must not be
    // pinned to one upfront.
    departmentId: z.string().min(1).optional(),
    start: z.string().datetime(),
    end: z.string().datetime(),
    reason: z.string().optional(),
    specialistOpenemrUuid: z.string().min(1).optional(),
    bookingEntryPath: z.enum(['SERVICE_PATH', 'DOCTOR_PATH']),
    followUpFromBookingId: z.string().min(1).optional(),
  })
  .refine((body) => !body.specialistOpenemrUuid || body.departmentId, {
    message: 'departmentId is required when specialistOpenemrUuid is set',
    path: ['departmentId'],
  });

/**
 * Reservation happens before identity is known — the whole point of a hold's
 * TTL is to lock the slot while the patient is still filling in their details
 * and verifying OTP. `patientIdentityId` is attached afterwards via `PATCH`.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  const data = parsed.data;

  const startAt = new Date(data.start);
  const endAt = new Date(data.end);
  if (endAt <= startAt) return NextResponse.json({ error: 'invalid_time_range' }, { status: 400 });
  if (startAt < new Date()) return NextResponse.json({ error: 'start_in_past' }, { status: 400 });

  const branch = await getBranchById(data.branchId);
  if (!branch || !branch.published) return NextResponse.json({ error: 'invalid_branch' }, { status: 400 });

  const service = await prisma.service.findUnique({ where: { id: data.serviceId } });
  if (!service || !service.active) return NextResponse.json({ error: 'invalid_service' }, { status: 400 });

  // A follow-up must continue a visit this same patient actually had —
  // checking ownership rather than mere existence keeps a crafted id from
  // confirming someone else's booking exists. Only checkable once a session
  // exists; an anonymous hold can't name a follow-up at all.
  if (data.followUpFromBookingId) {
    const original = session.patient
      ? await prisma.bookingHold.findFirst({
          where: { id: data.followUpFromBookingId, patientIdentityId: session.patient.id },
          select: { id: true },
        })
      : null;
    if (!original) return NextResponse.json({ error: 'invalid_follow_up' }, { status: 400 });
  }

  const engineInput = {
    serviceId: data.serviceId,
    branchId: data.branchId,
    startAt,
    endAt,
    patientIdentityId: session.patient?.id,
    reason: data.reason,
    bookingEntryPath: data.bookingEntryPath,
    followUpFromBookingId: data.followUpFromBookingId,
    isFollowUp: Boolean(data.followUpFromBookingId),
  };

  const result =
    data.specialistOpenemrUuid && data.departmentId
      ? await createPractitionerSelectedBookingHold({
          ...engineInput,
          specialistOpenemrUuid: data.specialistOpenemrUuid,
          departmentId: data.departmentId,
        })
      : await createAutoAssignedBookingHold(engineInput);

  if (!result.ok) {
    const status = result.reason === 'offering_invalid' ? 400 : 409;
    return NextResponse.json(
      { error: result.reason, details: 'details' in result ? result.details : undefined },
      { status },
    );
  }

  await prisma.auditLog.create({
    data: {
      actor: session.patient ? `patient:${session.patient.id}` : 'anonymous',
      action: 'booking_hold.created',
      target: result.hold.id,
      metadata: JSON.stringify({
        assignmentMode: result.hold.assignmentMode,
        practitionerOpenemrId: result.hold.practitionerOpenemrId,
      }),
    },
  });

  return NextResponse.json({
    ok: true,
    holdId: result.hold.id,
    practitionerId: result.hold.practitionerOpenemrId,
    practitionerName: result.hold.practitionerNameSnapshot,
    holdExpiresAt: result.hold.holdExpiresAt,
    priceMinor: result.hold.servicePriceSnapshot,
    durationMinutes: result.hold.serviceDurationSnapshot,
  });
}
