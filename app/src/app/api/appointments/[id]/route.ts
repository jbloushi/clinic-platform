import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDataProvider } from '@/lib/data';
import { requireStaff } from '@/lib/auth/guards';
import type { AppointmentStatus } from '@/lib/data/types';

const patchSchema = z.object({
  status: z.enum([
    'draft',
    'held',
    'pending_payment',
    'confirmed',
    'checked_in',
    'completed',
    'cancelled',
    'no_show',
  ] as const),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff(['reception', 'admin', 'doctor']);
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  try {
    const updated = await getDataProvider().updateAppointmentStatus(id, parsed.data.status as AppointmentStatus);
    return NextResponse.json({ ok: true, appointment: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'openemr_error' }, { status: e?.status ?? 500 });
  }
}
