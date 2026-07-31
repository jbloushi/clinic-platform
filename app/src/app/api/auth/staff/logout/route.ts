import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

/**
 * POST-only, deliberately. A `GET` handler here previously destroyed the
 * session — which meant Next.js's automatic `<Link>` prefetching (fires for
 * any link that scrolls into the viewport) silently logged staff out just by
 * the sign-out button being on screen, no click required. A `GET` must never
 * have a side effect for exactly this reason.
 */
export async function POST() {
  const s = await getSession();
  s.destroy();
  // Relative Location — the browser resolves it against the current origin
  // (the public domain), so this works behind any reverse proxy without needing
  // to know the external host. Absolute URLs built from req.url would use the
  // internal proxy host (e.g. localhost:PORT) and redirect there instead.
  return new NextResponse(null, { status: 303, headers: { Location: '/staff/login' } });
}
