import { NextRequest, NextResponse } from 'next/server';
import { listPractitionerOfferings } from '@/lib/data/offering-repo';

/**
 * Services with at least one bookable offering (auto-assign or patient
 * choice) at a branch — the same computation `/book/v2/service` does
 * server-side, exposed publicly so client-side flows (reschedule's
 * branch-change) can refetch it without an ops-only endpoint.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get('branchId');
  if (!branchId) return NextResponse.json({ error: 'branchId is required' }, { status: 400 });

  const offerings = await listPractitionerOfferings({ branchId, activeOnly: true, publishedOnly: true });

  const seen = new Set<string>();
  const services = offerings
    .filter((o) => o.allowAutoAssignment || o.allowPatientChoice)
    .filter((o) => {
      if (seen.has(o.serviceId)) return false;
      seen.add(o.serviceId);
      return true;
    })
    .map((o) => ({
      id: o.service.id,
      name: o.service.name,
      durationMinutes: o.service.durationMinutes,
      priceMinor: o.service.priceMinor,
      currency: o.service.currency,
    }));

  return NextResponse.json({ services });
}
