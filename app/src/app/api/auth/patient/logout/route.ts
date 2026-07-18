import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const s = await getSession();
  s.destroy();
  // Redirect to the site's real origin (not the internal proxy host). Honor the
  // forwarded proto (https in prod) but keep req.url's scheme locally.
  const url = new URL('/', req.url);
  const proto = req.headers.get('x-forwarded-proto');
  if (proto) url.protocol = `${proto}:`;
  return NextResponse.redirect(url);
}
