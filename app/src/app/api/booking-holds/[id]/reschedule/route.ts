import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { rescheduleBookingHold } from '@/lib/data/reschedule';

const bodySchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  branchId: z.string().min(1).optional(),
  serviceId: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
  // absent = keep current doctor; null = auto-reassign; string = named pick
  specialistOpenemrUuid: z.string().min(1).nullable().optional(),
  reason: z.string().optional(),
});

/**
 * Branch/doctor/service-changing reschedule for a `BookingHold` created by
 * the new engine. Distinct from `PATCH /api/bookings/[id]`, which stays
 * same-doctor/branch/service-only and keeps serving the old booking model.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const staff = session.staff;
  const patient = session.patient;
  if (!staff && !patient) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const current = await prisma.bookingHold.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const staffMayChange = staff ? ['reception', 'admin', 'doctor'].includes(staff.role) : false;
  const isOwner = patient ? current.patientIdentityId === patient.id : false;
  if (!staffMayChange && !isOwner) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const data = parsed.data;
  if (data.specialistOpenemrUuid && !data.departmentId) {
    return NextResponse.json({ error: 'department_required_for_named_doctor' }, { status: 400 });
  }

  const actor = staff ? `staff:${staff.id}` : `patient:${patient!.id}`;

  const result = await rescheduleBookingHold({
    currentHoldId: id,
    branchId: data.branchId,
    serviceId: data.serviceId,
    departmentId: data.departmentId,
    specialistOpenemrUuid: data.specialistOpenemrUuid,
    startAt: new Date(data.start),
    endAt: new Date(data.end),
    reason: data.reason,
    actor,
  });

  if (!result.ok) {
    const status =
      result.reason === 'hold_not_found'
        ? 404
        : result.reason === 'start_in_past'
          ? 400
          : result.reason === 'offering_invalid'
            ? 400
            : 409;
    return NextResponse.json(
      { error: result.reason, details: 'details' in result ? result.details : undefined },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    holdId: result.hold.id,
    status: result.hold.status,
    paymentRequired: result.paymentRequired,
  });
}
