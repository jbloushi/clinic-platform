import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';
import { setServiceSpecialists } from '@/lib/data/platform-repo';

const bodySchema = z.object({
  specialistUuids: z.array(z.string().min(1)),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff(['admin']);
  const { id } = await params;

  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  await setServiceSpecialists(id, parsed.data.specialistUuids);
  return NextResponse.json({ ok: true });
}
