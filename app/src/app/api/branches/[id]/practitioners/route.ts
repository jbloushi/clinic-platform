import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';
import { setBranchPractitioners } from '@/lib/data/reference-repo';

const bodySchema = z.object({
  specialistUuids: z.array(z.string().min(1)),
});

/**
 * Replace the set of practitioners who work at this branch.
 *
 * An empty set does NOT mean "nobody works here" — a practitioner with no
 * branch links at all is treated as working everywhere, so clearing this list
 * simply removes any restriction that named them here.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff(['admin']);
  const { id } = await params;

  const branch = await prisma.branch.findUnique({ where: { id } });
  if (!branch) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  await setBranchPractitioners(id, parsed.data.specialistUuids);
  return NextResponse.json({ ok: true });
}
