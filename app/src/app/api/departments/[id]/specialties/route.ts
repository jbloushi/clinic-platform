import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';
import { setDepartmentSpecialties } from '@/lib/data/reference-repo';

const bodySchema = z.object({
  specialties: z.array(z.string().min(1)),
});

/**
 * Replace the OpenEMR specialty strings that map into this department.
 *
 * This mapping is what makes "show me the doctors in Gastroenterology" work:
 * OpenEMR has no department, only a free-text specialty per practitioner, so
 * the department is defined by which of those strings belong to it.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff(['admin']);
  const { id } = await params;

  const department = await prisma.department.findUnique({ where: { id } });
  if (!department) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  await setDepartmentSpecialties(id, parsed.data.specialties);
  return NextResponse.json({ ok: true });
}
