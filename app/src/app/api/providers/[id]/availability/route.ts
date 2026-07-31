import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/guards';
import { upsertAvailabilityRules } from '@/lib/data/availability-repo';

const bodySchema = z.object({
  rules: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      slotMinutes: z.number().int().min(5).max(120),
    }),
  ),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff(['admin']);
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  await upsertAvailabilityRules(id, parsed.data.rules);
  return NextResponse.json({ ok: true });
}
