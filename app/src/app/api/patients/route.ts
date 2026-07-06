import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDataProvider } from '@/lib/data';
import { requireStaff } from '@/lib/auth/guards';

const bodySchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  mobile: z.string().default(''),
  email: z.string().email().optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  sex: z.enum(['male', 'female', 'other', 'unknown']).default('unknown'),
});

export async function POST(req: NextRequest) {
  await requireStaff(['reception', 'admin']);
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  try {
    const patient = await getDataProvider().createPatient({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      mobile: parsed.data.mobile,
      email: parsed.data.email || undefined,
      dateOfBirth: parsed.data.dateOfBirth || undefined,
      sex: parsed.data.sex,
    });
    return NextResponse.json({ ok: true, patient });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'openemr_error' }, { status: e?.status ?? 500 });
  }
}
