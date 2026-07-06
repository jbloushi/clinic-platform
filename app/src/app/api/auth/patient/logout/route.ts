import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  const s = await getSession();
  s.destroy();
  return NextResponse.redirect(new URL('/', 'http://localhost:3000'));
}
