import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';
import { uniqueSlug } from '@/lib/slug';

const bodySchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  summaryEn: z.string().optional(),
  summaryAr: z.string().optional(),
  departmentId: z.string().min(1).nullable().optional(),
  durationMinutes: z.number().int().min(5).max(240),
  priceMinor: z.number().int().min(0),
  currency: z.string().default('KWD'),
  showInServiceSearch: z.boolean().default(true),
  publishedOnWeb: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  await requireStaff(['admin']);
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const { departmentId, ...data } = parsed.data;

  // Slug is derived rather than asked for: it exists to address the service on
  // the public site, and making ops invent one is a way to get inconsistent
  // ones. Collisions are resolved against the current set, then again by the
  // unique index if two creates race.
  const existing = await prisma.service.findMany({ select: { slug: true } });
  const slug = uniqueSlug(data.name, existing.map((s) => s.slug), 'service');

  try {
    const created = await prisma.service.create({
      data: { ...data, slug, departmentId: departmentId ?? null },
    });
    return NextResponse.json({ ok: true, service: created });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'slug_taken' }, { status: 409 });
    }
    throw e;
  }
}
