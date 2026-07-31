import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/guards';
import { createPractitionerOffering, listPractitionerOfferings, OfferingParentError } from '@/lib/data/offering-repo';

const createSchema = z.object({
  specialistOpenemrUuid: z.string().min(1),
  serviceId: z.string().min(1),
  departmentId: z.string().min(1),
  branchId: z.string().min(1),
  active: z.boolean().optional(),
  publishedOnWeb: z.boolean().optional(),
  allowAutoAssignment: z.boolean().optional(),
  allowPatientChoice: z.boolean().optional(),
  assignmentPriority: z.number().int().min(0).optional(),
  assignmentPriorityTier: z.enum(['PREFERRED', 'NORMAL', 'BACKUP']).optional(),
  durationMinutes: z.number().int().min(5).max(240).nullable().optional(),
  priceMinor: z.number().int().min(0).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

/** List offerings, optionally filtered — backs the /ops/offerings table. */
export async function GET(req: NextRequest) {
  await requireStaff(['admin']);
  const { searchParams } = new URL(req.url);
  const offerings = await listPractitionerOfferings({
    branchId: searchParams.get('branchId') ?? undefined,
    departmentId: searchParams.get('departmentId') ?? undefined,
    serviceId: searchParams.get('serviceId') ?? undefined,
    specialistOpenemrUuid: searchParams.get('specialistOpenemrUuid') ?? undefined,
  });
  return NextResponse.json({ offerings });
}

/**
 * The who/what/where of an offering is immutable once created (see
 * `updatePractitionerOffering`) — changing which doctor, service, department
 * or branch a row is about is a new statement, not an edit of the old one.
 */
export async function POST(req: NextRequest) {
  await requireStaff(['admin']);
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  try {
    const offering = await createPractitionerOffering(parsed.data);
    return NextResponse.json({ ok: true, offering });
  } catch (e) {
    if (e instanceof OfferingParentError) {
      return NextResponse.json({ error: 'missing_prerequisites', missing: e.missing }, { status: 409 });
    }
    if ((e as any)?.code === 'P2002') {
      return NextResponse.json({ error: 'offering_already_exists' }, { status: 409 });
    }
    throw e;
  }
}
