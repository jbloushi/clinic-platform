import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';

// null = clear the override and fall back to the clinic-wide default.
const bodySchema = z.object({ bufferMinutes: z.number().int().min(0).max(240).nullable() });

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff(['admin']);
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  if (parsed.data.bufferMinutes === null) {
    await prisma.practitionerTravelBuffer.deleteMany({ where: { specialistOpenemrUuid: id } });
    return NextResponse.json({ ok: true });
  }

  await prisma.practitionerTravelBuffer.upsert({
    where: { specialistOpenemrUuid: id },
    create: { specialistOpenemrUuid: id, bufferMinutes: parsed.data.bufferMinutes },
    update: { bufferMinutes: parsed.data.bufferMinutes },
  });
  return NextResponse.json({ ok: true });
}
