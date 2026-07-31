import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';
import { uniqueSlug } from '@/lib/slug';

const bodySchema = z.object({
  nameEn: z.string().min(1),
  nameAr: z.string().min(1),
  summaryEn: z.string().default(''),
  summaryAr: z.string().default(''),
  published: z.boolean().default(true),
  sortOrder: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  await requireStaff(['admin']);
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const existing = await prisma.department.findMany({ select: { slug: true } });
  const slug = uniqueSlug(parsed.data.nameEn, existing.map((d) => d.slug), 'department');

  // New departments sort to the end rather than the top, so adding one doesn't
  // silently reorder the homepage tiles.
  const sortOrder = parsed.data.sortOrder ?? existing.length;

  try {
    const created = await prisma.department.create({ data: { ...parsed.data, slug, sortOrder } });
    return NextResponse.json({ ok: true, department: created });
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'slug_taken' }, { status: 409 });
    throw e;
  }
}
