import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/guards';
import { copyPractitionerOfferingsBetweenBranches } from '@/lib/data/offering-repo';

const bodySchema = z.object({
  fromBranchId: z.string().min(1),
  toBranchId: z.string().min(1),
  dryRun: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  await requireStaff(['admin']);
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  if (parsed.data.fromBranchId === parsed.data.toBranchId) {
    return NextResponse.json({ error: 'same_branch' }, { status: 400 });
  }

  const result = await copyPractitionerOfferingsBetweenBranches(parsed.data.fromBranchId, parsed.data.toBranchId, {
    dryRun: parsed.data.dryRun,
  });
  return NextResponse.json({ ok: true, ...result });
}
