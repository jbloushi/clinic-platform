import { NextResponse } from 'next/server';
import { restJson } from '@/lib/data/openemr/client';

// Local debug endpoint. Remove before deploying anywhere.
export async function GET() {
  const raw = await restJson<any>('/practitioner').catch((e) => ({ error: e?.message }));
  return NextResponse.json(raw);
}
