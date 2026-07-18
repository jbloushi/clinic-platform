import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';

const bodySchema = z.object({
  name: z.string().min(1),
  durationMinutes: z.number().int().min(5).max(240),
  priceMinor: z.number().int().min(0),
  currency: z.string().default('USD'),
  showInServiceSearch: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  await requireStaff(['admin']);
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  const created = await prisma.service.create({ data: parsed.data });
  return NextResponse.json({ ok: true, service: created });
}
