import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';

const bodySchema = z.object({
  role: z.enum(['reception', 'doctor', 'admin', 'finance']).optional(),
  active: z.boolean().optional(),
  openemrUserId: z.string().min(1).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff(['admin']);
  const { id } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.staffUser.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const updated = await prisma.staffUser.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ok: true, user: updated });
}
