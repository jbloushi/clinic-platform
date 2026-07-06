import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';
import { getDataProvider } from '@/lib/data';

const bodySchema = z.object({
  patientId: z.string().min(1),
  chiefComplaint: z.string().optional().default(''),
  note: z.string().optional().default(''),
  prescription: z.object({ drug: z.string(), dosage: z.string().optional() }).nullable().optional(),
  orders: z.array(z.object({ type: z.string(), text: z.string() })).default([]),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff(['doctor', 'admin']);
  const { id: appointmentId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  // For P1 we log the encounter to our audit log (structured JSON, no PHI in message).
  await prisma.auditLog.create({
    data: {
      actor: `staff:${staff.id}`,
      action: 'encounter.signed',
      target: appointmentId,
      metadata: JSON.stringify(parsed.data),
    },
  });

  // Best-effort: mark the appointment completed in OpenEMR
  try {
    await getDataProvider().updateAppointmentStatus(appointmentId, 'completed');
  } catch {
    // don't fail the sign if the status update errors — the note is what matters
  }

  return NextResponse.json({ ok: true });
}
