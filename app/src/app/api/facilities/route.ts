import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/guards';
import { getDataProvider } from '@/lib/data';

/** OpenEMR clinic locations, for linking a platform Branch to one. */
export async function GET() {
  await requireStaff(['admin']);
  try {
    const facilities = await getDataProvider().getFacilities();
    return NextResponse.json({ facilities });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'facilities_unavailable' }, { status: 502 });
  }
}

const bodySchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
});

/**
 * Create a clinic location in OpenEMR.
 *
 * Offered because a second branch usually doesn't exist there yet, and sending
 * an admin into OpenEMR's own UI mid-task to create one is a worse handoff than
 * doing it here. The resulting facility is then linked to a platform Branch.
 */
export async function POST(req: NextRequest) {
  await requireStaff(['admin']);
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  try {
    const facility = await getDataProvider().createFacility(parsed.data);
    return NextResponse.json({ ok: true, facility });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'facility_create_failed' }, { status: 502 });
  }
}
