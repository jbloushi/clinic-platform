import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/data';

/** Free/busy slots for one already-chosen doctor — the doctor-path counterpart to `/api/availability/bulk`. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const practitionerId = searchParams.get('practitionerId');
  const branchId = searchParams.get('branchId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const durationMinutes = searchParams.get('durationMinutes');
  if (!practitionerId || !branchId || !from || !to) {
    return NextResponse.json({ error: 'practitionerId, branchId, from and to are required' }, { status: 400 });
  }

  const slots = await getDataProvider().getAvailableSlots(
    practitionerId,
    from,
    to,
    durationMinutes ? Number(durationMinutes) : undefined,
    { branchId },
  );
  return NextResponse.json({ slots });
}
