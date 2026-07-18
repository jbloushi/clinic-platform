import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

// Redirect back to the site the request actually came in on (behind a reverse
// proxy the internal host is 127.0.0.1:PORT, so we can't hardcode it). Uses the
// forwarded proto when present (https in production) but keeps req.url's scheme
// locally.
function siteUrl(req: NextRequest, path: string): URL {
  const url = new URL(path, req.url);
  const proto = req.headers.get('x-forwarded-proto');
  if (proto) url.protocol = `${proto}:`;
  return url;
}

export async function GET(req: NextRequest) {
  const s = await getSession();
  s.destroy();
  return NextResponse.redirect(siteUrl(req, '/staff/login'));
}

export async function POST() {
  const s = await getSession();
  s.destroy();
  return NextResponse.json({ ok: true });
}
