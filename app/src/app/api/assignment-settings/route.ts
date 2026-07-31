import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';

const patchSchema = z.object({
  preferPreviousPractitioner: z.boolean(),
  workloadWindowDays: z.number().int().min(1).max(365),
  useLeastRecentlyAssigned: z.boolean(),
  allowBackupTier: z.boolean(),
  holdDurationMinutes: z.number().int().min(1).max(180),
  slotSearchWindowDays: z.number().int().min(1).max(180),
  slotQuantumMinutes: z.number().int().min(1).max(60),
  showDoctorNameBeforePayment: z.boolean(),
});

/**
 * The single `AssignmentSettings` row every auto-assignment decision and hold
 * TTL reads (see `booking-hold-engine.ts`'s `getAssignmentSettings`). Never
 * written by anything before this route — previously the only way to change
 * these values was a direct DB edit.
 */
export async function GET() {
  await requireStaff(['admin']);
  const settings = await prisma.assignmentSettings.upsert({
    where: { id: 'singleton' },
    create: {},
    update: {},
  });
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  await requireStaff(['admin']);
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const settings = await prisma.assignmentSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...parsed.data },
    update: parsed.data,
  });
  return NextResponse.json({ ok: true, settings });
}
