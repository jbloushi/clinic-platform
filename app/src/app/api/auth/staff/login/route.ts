import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { getSession } from '@/lib/auth/session';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const user = await prisma.staffUser.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || !user.active || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const session = await getSession();
  session.patient = undefined;
  session.staff = {
    id: user.id,
    email: user.email,
    role: user.role as 'reception' | 'doctor' | 'admin' | 'finance',
    firstName: user.firstName,
    lastName: user.lastName,
    openemrUserId: user.openemrUserId ?? undefined,
  };
  await session.save();

  await prisma.sessionLog.create({
    data: { subject: `staff:${user.id}`, event: 'login', ip: req.headers.get('x-forwarded-for') ?? undefined },
  });

  const dest = user.role === 'doctor' ? '/doctor' : '/ops';
  return NextResponse.json({ redirect: dest });
}
