import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { normalizeMobile } from '@/lib/auth/mobile';

const bodySchema = z.object({ mobile: z.string().min(6) });

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const mobile = normalizeMobile(parsed.data.mobile);
  const code = env.OTP_MODE === 'mock' ? '123456' : String(Math.floor(100000 + Math.random() * 900000));

  await prisma.otpCode.create({
    data: { mobile, code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });

  return NextResponse.json({ ok: true, mock: env.OTP_MODE === 'mock' ? code : undefined });
}
