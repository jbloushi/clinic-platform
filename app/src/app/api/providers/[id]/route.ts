import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDataProvider } from '@/lib/data';
import { requireStaff } from '@/lib/auth/guards';

const bodySchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  specialty: z.string().min(1).optional(),
  role: z.string().optional(),
  npi: z.string().optional(),
  bio: z.string().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff(['admin']);
  const { id } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 });

  const { active, ...details } = parsed.data;
  const dp = getDataProvider();

  try {
    if (Object.keys(details).length > 0) {
      await dp.updatePractitioner(id, details);
    }
    if (active !== undefined) {
      await dp.setPractitionerActive(id, active);
    }
    const updated = await dp.getPractitionerById(id);
    if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, practitioner: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'openemr_error' }, { status: e?.status ?? 500 });
  }
}
