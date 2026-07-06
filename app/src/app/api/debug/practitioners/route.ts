import { NextResponse } from 'next/server';

// Placeholder — debug endpoint kept only in dev. Returns 404 in production.
export async function GET() {
  if (process.env.APP_ENV === 'production') return new NextResponse(null, { status: 404 });
  const { restJson } = await import('@/lib/data/openemr/client');
  const raw = await restJson<any>('/practitioner', { query: { _count: 100 } }).catch((e) => ({ error: e?.message }));
  return NextResponse.json(raw);
}
