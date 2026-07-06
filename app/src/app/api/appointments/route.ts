import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDataProvider } from '@/lib/data';
import { requireStaff } from '@/lib/auth/guards';

const bodySchema = z.object({
  patientId: z.string().min(1),
  practitionerId: z.string().min(1),
  start: z.string().datetime(),
  end: z.string().datetime(),
  reason: z.string().optional(),
});

export async function POST(req: NextRequest) {
  await requireStaff(['reception', 'admin', 'doctor']);
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  try {
    // Race check: refetch and ensure no conflict for this practitioner in this slot.
    const dp = getDataProvider();
    const day = parsed.data.start.slice(0, 10);
    const dayAppointments = await dp
      .getAppointments({ practitionerId: parsed.data.practitionerId, from: day, to: day })
      .catch(() => []);
    const conflict = dayAppointments.some(
      (a) => new Date(a.start).getTime() < new Date(parsed.data.end).getTime() && new Date(a.end).getTime() > new Date(parsed.data.start).getTime() && a.status !== 'cancelled',
    );
    if (conflict) return NextResponse.json({ error: 'slot_conflict' }, { status: 409 });

    const created = await dp.createAppointment(parsed.data);
    return NextResponse.json({ ok: true, appointment: created });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'openemr_error' }, { status: e?.status ?? 500 });
  }
}
