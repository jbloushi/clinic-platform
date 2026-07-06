import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  const s = await getSession();
  s.destroy();
  return NextResponse.redirect(new URL('/staff/login', 'http://localhost:3000'));
}

export async function POST() {
  const s = await getSession();
  s.destroy();
  return NextResponse.json({ ok: true });
}
