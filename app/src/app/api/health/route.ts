import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { env, useMock } from '@/lib/env';
import { restJson } from '@/lib/data/openemr/client';
import { isWhatsAppConfigured } from '@/lib/whatsapp';
import { isChatwootConfigured } from '@/lib/chatwoot';

export const dynamic = 'force-dynamic';

type Check = { ok: boolean; detail?: string };

/**
 * Liveness and dependency check.
 *
 * Reports each dependency separately rather than a single boolean, because they
 * fail independently and the response is meant to say *what* is wrong. The
 * platform DB is the only hard requirement — without it nothing works — so it
 * alone decides the HTTP status; a degraded EMR still lets patients browse and
 * staff sign in.
 *
 * No authentication: it exposes only whether things are configured and
 * reachable, never credentials or patient data, and a monitor has to be able to
 * call it while the app is broken.
 */
export async function GET() {
  const [database, emr] = await Promise.all([checkDatabase(), checkOpenEmr()]);

  const notifications: Check = {
    ok: isWhatsAppConfigured(),
    detail: isWhatsAppConfigured()
      ? isChatwootConfigured()
        ? 'whatsapp + chatwoot notes'
        : 'whatsapp only (no agent notes)'
      : 'not configured — no patient messages will be sent',
  };

  return NextResponse.json(
    {
      ok: database.ok,
      environment: env.APP_ENV,
      dataSource: useMock ? 'mock' : 'openemr',
      writesAllowed: env.ALLOW_WRITES,
      checks: { database, emr, notifications },
      time: new Date().toISOString(),
    },
    { status: database.ok ? 200 : 503 },
  );
}

async function checkDatabase(): Promise<Check> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (e: any) {
    return { ok: false, detail: e?.message ?? 'unreachable' };
  }
}

async function checkOpenEmr(): Promise<Check> {
  if (useMock) return { ok: true, detail: 'mock provider — OpenEMR not contacted' };
  try {
    // A tiny authenticated read: proves the base URL resolves, OAuth succeeds,
    // and the API answers, without pulling patient data to do it.
    await restJson<any>('/facility', { query: { limit: 1 } });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, detail: e?.message ?? 'unreachable' };
  }
}
