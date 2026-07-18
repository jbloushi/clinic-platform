import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDataProvider } from '@/lib/data';
import { requireStaff } from '@/lib/auth/guards';

const bodySchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  title: z.string().default('Dr.'),
  specialty: z.string().min(1),
  consultationFeeMinor: z.number().int().nonnegative().default(15000),
  bio: z.string().optional(),
});

export async function POST(req: NextRequest) {
  await requireStaff(['admin']);
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 });

  try {
    const created = await getDataProvider().createPractitioner({
      ...parsed.data,
      currency: 'KWD',
      active: true,
      availability: [],
    });
    return NextResponse.json({ ok: true, practitioner: created });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'openemr_error' }, { status: e?.status ?? 500 });
  }
}
