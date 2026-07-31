import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { updatePractitionerOffering, deletePractitionerOffering } from '@/lib/data/offering-repo';
import { requireStaff } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';

const patchSchema = z.object({
  active: z.boolean().optional(),
  publishedOnWeb: z.boolean().optional(),
  allowAutoAssignment: z.boolean().optional(),
  allowPatientChoice: z.boolean().optional(),
  assignmentPriority: z.number().int().min(0).optional(),
  assignmentPriorityTier: z.enum(['PREFERRED', 'NORMAL', 'BACKUP']).optional(),
  durationMinutes: z.number().int().min(5).max(240).nullable().optional(),
  priceMinor: z.number().int().min(0).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

/** Only the mutable fields (never who/what/where — see offering-repo.ts). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff(['admin']);
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const existing = await prisma.practitionerOffering.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const updated = await updatePractitionerOffering(id, parsed.data);
  return NextResponse.json({ ok: true, offering: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff(['admin']);
  const { id } = await params;

  const existing = await prisma.practitionerOffering.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const result = await deletePractitionerOffering(id);
  return NextResponse.json({ ok: true, ...result });
}
