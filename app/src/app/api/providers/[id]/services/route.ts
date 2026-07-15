import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/guards';
import { setSpecialistServices } from '@/lib/data/platform-repo';

const bodySchema = z.object({
  serviceIds: z.array(z.string().min(1)),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff(['admin']);
  const { id } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  await setSpecialistServices(id, parsed.data.serviceIds);
  return NextResponse.json({ ok: true });
}
