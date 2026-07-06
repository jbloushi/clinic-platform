import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

export type SessionData = {
  staff?: {
    id: string;
    email: string;
    role: 'reception' | 'doctor' | 'admin' | 'finance';
    firstName: string;
    lastName: string;
    openemrUserId?: string;
  };
  patient?: {
    id: string;
    mobile: string;
    firstName?: string;
    lastName?: string;
    openemrPatientUuid?: string;
  };
};

const options: SessionOptions = {
  password: env.AUTH_SESSION_SECRET,
  cookieName: 'clinic_session',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.APP_ENV === 'production',
  },
};

export async function getSession() {
  const store = await cookies();
  return getIronSession<SessionData>(store, options);
}
