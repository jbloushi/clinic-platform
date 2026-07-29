import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { getSession } from '@/lib/auth/session';
import { useMock } from '@/lib/env';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const email = parsed.data.email.toLowerCase();
  const mockUser = useMock ? getMockStaffUser(email, parsed.data.password) : null;
  let user: {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
    openemrUserId: string | null;
    active: boolean;
    passwordHash?: string;
  } | null = mockUser;

  if (!useMock) {
    try {
      user = await prisma.staffUser.findUnique({ where: { email } });
    } catch {
      return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
    }
  }
  if (!user || !user.active || (!useMock && (!user.passwordHash || !verifyPassword(parsed.data.password, user.passwordHash)))) {
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

  if (!useMock) {
    await prisma.sessionLog.create({
      data: { subject: `staff:${user.id}`, event: 'login', ip: req.headers.get('x-forwarded-for') ?? undefined },
    }).catch(() => undefined);
  }

  const dest = user.role === 'doctor' ? '/doctor' : '/ops';
  return NextResponse.json({ redirect: dest });
}

const MOCK_STAFF = [
  { email: 'admin@clinic.local', role: 'admin', firstName: 'Amina', lastName: 'Admin' },
  { email: 'reception@clinic.local', role: 'reception', firstName: 'Rana', lastName: 'Reception' },
  { email: 'doctor@clinic.local', role: 'doctor', firstName: 'Yusuf', lastName: 'Rahman' },
  { email: 'finance@clinic.local', role: 'finance', firstName: 'Faisal', lastName: 'Finance' },
] as const;

function getMockStaffUser(email: string, password: string) {
  if (password !== 'demo1234') return null;
  const staff = MOCK_STAFF.find((candidate) => candidate.email === email);
  if (!staff) return null;
  return {
    id: `mock-${staff.role}`,
    ...staff,
    openemrUserId: staff.role === 'doctor' ? 'mock-practitioner-2' : null,
    active: true,
  };
}
