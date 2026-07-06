import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { normalizeMobile } from '@/lib/auth/mobile';

const bodySchema = z.object({
  mobile: z.string().min(6),
  code: z.string().length(6),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const mobile = normalizeMobile(parsed.data.mobile);
  const otp = await prisma.otpCode.findFirst({
    where: { mobile, code: parsed.data.code, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) return NextResponse.json({ error: 'invalid_code' }, { status: 401 });

  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

  const identity = await prisma.patientIdentity.upsert({
    where: { mobile },
    update: {
      firstName: parsed.data.firstName ?? undefined,
      lastName: parsed.data.lastName ?? undefined,
      lastLoginAt: new Date(),
    },
    create: {
      mobile,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      lastLoginAt: new Date(),
    },
  });

  const session = await getSession();
  session.staff = undefined;
  session.patient = {
    id: identity.id,
    mobile: identity.mobile,
    firstName: identity.firstName ?? undefined,
    lastName: identity.lastName ?? undefined,
    openemrPatientUuid: identity.openemrPatientUuid ?? undefined,
  };
  await session.save();

  await prisma.sessionLog.create({
    data: { subject: `patient:${identity.id}`, event: 'login' },
  });

  return NextResponse.json({ ok: true, redirect: '/account/appointments' });
}
