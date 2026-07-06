import { NextResponse } from 'next/server';
import { restJson } from '@/lib/data/openemr/client';

export async function GET(_req: Request, { params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;
  const raw = await restJson<any>(`/patient/${encodeURIComponent(uuid)}`).catch((e) => ({ error: e?.message }));
  return NextResponse.json(raw);
}
