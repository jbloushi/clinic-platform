import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  const s = await getSession();
  s.destroy();
  // Relative Location — the browser resolves it against the current origin
  // (the public domain), so this works behind any reverse proxy without needing
  // to know the external host. Absolute URLs built from req.url would use the
  // internal proxy host (e.g. localhost:PORT) and redirect there instead.
  return new NextResponse(null, { status: 303, headers: { Location: '/' } });
}
