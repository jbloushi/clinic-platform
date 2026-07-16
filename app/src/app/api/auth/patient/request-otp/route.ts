import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { normalizeMobile } from '@/lib/auth/mobile';
import { sendWhatsAppOtp } from '@/lib/chatwoot';

const bodySchema = z.object({ mobile: z.string().min(6) });

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const mobile = normalizeMobile(parsed.data.mobile);
  const code = env.OTP_MODE === 'mock' ? '123456' : String(Math.floor(100000 + Math.random() * 900000));

  // Deliver before persisting: a code we failed to send shouldn't sit in the
  // table as a live, unused credential. `sms` has no provider wired up yet —
  // fail loudly rather than silently pretending the code went out.
  if (env.OTP_MODE === 'whatsapp') {
    try {
      await sendWhatsAppOtp(mobile, code);
    } catch (e: any) {
      return NextResponse.json({ error: `otp_delivery_failed: ${e?.message ?? e}` }, { status: 502 });
    }
  } else if (env.OTP_MODE === 'sms') {
    return NextResponse.json({ error: 'otp_delivery_not_implemented' }, { status: 501 });
  }

  await prisma.otpCode.create({
    data: { mobile, code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });

  return NextResponse.json({ ok: true, mock: env.OTP_MODE === 'mock' ? code : undefined });
}
