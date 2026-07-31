import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';
import { uniqueSlug } from '@/lib/slug';

const bodySchema = z.object({
  nameEn: z.string().min(1),
  nameAr: z.string().min(1),
  areaEn: z.string().min(1),
  areaAr: z.string().min(1),
  addressLine: z.string().optional(),
  phone: z.string().optional(),
  mapUrl: z.string().optional(),
  openemrFacilityId: z.number().int().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  await requireStaff(['admin']);
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const existing = await prisma.branch.findMany({ select: { slug: true } });
  const slug = uniqueSlug(parsed.data.nameEn, existing.map((b) => b.slug), 'branch');

  try {
    const created = await prisma.branch.create({
      data: {
        ...parsed.data,
        slug,
        sortOrder: parsed.data.sortOrder ?? existing.length,
        // Always created unpublished. A branch is only real once it points at
        // an OpenEMR facility, and that's a separate step.
        published: false,
      },
    });
    return NextResponse.json({ ok: true, branch: created });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'slug_or_facility_taken' }, { status: 409 });
    }
    throw e;
  }
}
