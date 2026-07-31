import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';
import { uniqueSlug } from '@/lib/slug';

const patchSchema = z.object({
  nameEn: z.string().min(1).optional(),
  nameAr: z.string().min(1).optional(),
  summaryEn: z.string().optional(),
  summaryAr: z.string().optional(),
  published: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  /** Only when ops deliberately wants the public URL to change. */
  regenerateSlug: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff(['admin']);
  const { id } = await params;

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { regenerateSlug, ...data } = parsed.data;

  // Renaming does not move /departments/<slug> unless asked: inbound links and
  // anything already printed would break silently.
  let slug: string | undefined;
  if (regenerateSlug && data.nameEn) {
    const others = await prisma.department.findMany({
      where: { NOT: { id } },
      select: { slug: true },
    });
    slug = uniqueSlug(data.nameEn, others.map((d) => d.slug), 'department');
  }

  try {
    const updated = await prisma.department.update({
      where: { id },
      data: { ...data, ...(slug ? { slug } : {}) },
    });
    return NextResponse.json({ ok: true, department: updated });
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'slug_taken' }, { status: 409 });
    throw e;
  }
}

/**
 * Delete a department.
 *
 * Its specialty mappings cascade (they describe the department and mean nothing
 * without it), while services fall back to no department rather than being
 * deleted — a service is a bookable thing in its own right and outlives the
 * grouping it happened to sit under.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff(['admin']);
  const { id } = await params;

  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const orphaned = await prisma.service.count({ where: { departmentId: id } });
  await prisma.department.delete({ where: { id } });

  return NextResponse.json({ ok: true, uncategorisedServices: orphaned });
}
