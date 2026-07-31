import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';
import { getDataProvider } from '@/lib/data';
import { useMock } from '@/lib/env';
import { writeEncounter } from '@/lib/data/openemr/encounter-write';

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

  // Audit first, unconditionally. Whatever happens downstream, the record that
  // this clinician signed this note at this time must exist.
  await prisma.auditLog.create({
    data: {
      actor: `staff:${staff.id}`,
      action: 'encounter.signed',
      target: appointmentId,
      metadata: JSON.stringify(parsed.data),
    },
  });

  // Persist the encounter into the medical record. A signed note that lives
  // only in our audit log isn't in the patient's chart, which is where the next
  // clinician will look for it — so a failure here is reported rather than
  // swallowed, even though the note is already durably recorded above.
  let emrWarning: string | undefined;
  if (!useMock) {
    try {
      await writeEncounter({
        patientId: parsed.data.patientId,
        practitionerId: staff.openemrUserId,
        appointmentId,
        chiefComplaint: parsed.data.chiefComplaint,
        note: parsed.data.note,
        prescription: parsed.data.prescription ?? undefined,
      });
    } catch (e: any) {
      emrWarning = `encounter_not_written: ${e?.message ?? e}`;
    }
  }

  // Best-effort: mark the appointment completed in OpenEMR. The note is what
  // matters clinically, and a stale status is correctable from the calendar.
  try {
    await getDataProvider().updateAppointmentStatus(appointmentId, 'completed');
  } catch {
    /* leave the status alone rather than failing the sign */
  }

  return NextResponse.json({ ok: true, warning: emrWarning });
}
