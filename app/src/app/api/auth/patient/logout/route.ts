import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

/**
 * POST-only, deliberately — see the staff logout route for why a `GET`
 * handler here is unsafe (Next.js's `<Link>` prefetch would silently log
 * patients out the moment the sign-out button scrolls into view, which it
 * always is: it lives in `account/layout.tsx`'s `sticky top-0` header).
 */
export async function POST() {
  const s = await getSession();
  s.destroy();
  // Relative Location — the browser resolves it against the current origin
  // (the public domain), so this works behind any reverse proxy without needing
  // to know the external host. Absolute URLs built from req.url would use the
  // internal proxy host (e.g. localhost:PORT) and redirect there instead.
  return new NextResponse(null, { status: 303, headers: { Location: '/' } });
}
