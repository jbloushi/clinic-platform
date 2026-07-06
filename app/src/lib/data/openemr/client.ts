import { env, allowWrites } from '@/lib/env';

/**
 * OpenEMR OAuth2 token acquisition + caching + auto-refresh, plus small
 * fetch helpers for the Standard REST API and FHIR R4 API. Server-only.
 */

type TokenBundle = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  fetchedAt: number; // ms
};

let cached: TokenBundle | null = null;
let inflight: Promise<TokenBundle> | null = null;

function isExpired(t: TokenBundle): boolean {
  const skewMs = 30_000;
  return Date.now() >= t.fetchedAt + t.expires_in * 1000 - skewMs;
}

async function requestToken(): Promise<TokenBundle> {
  const body = new URLSearchParams();

  if (env.OPENEMR_GRANT_TYPE === 'password') {
    body.set('grant_type', 'password');
    body.set('client_id', env.OPENEMR_CLIENT_ID);
    body.set('client_secret', env.OPENEMR_CLIENT_SECRET);
    body.set('user_role', 'users');
    body.set('scope', env.OPENEMR_SCOPES);
    body.set('username', env.OPENEMR_API_USERNAME);
    body.set('password', env.OPENEMR_API_PASSWORD);
  } else {
    body.set('grant_type', 'client_credentials');
    body.set('client_id', env.OPENEMR_CLIENT_ID);
    body.set('scope', env.OPENEMR_SCOPES);
    // client_credentials requires JWKS-based client assertion in OpenEMR;
    // caller must configure that path in production. Not implemented in demo.
  }

  const res = await fetch(env.OPENEMR_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new OpenEMRError(res.status, `Token exchange failed: ${text}`);
  }
  const json = (await res.json()) as Omit<TokenBundle, 'fetchedAt'>;
  return { ...json, fetchedAt: Date.now() };
}

export async function getAccessToken(): Promise<string> {
  if (cached && !isExpired(cached)) return cached.access_token;
  if (inflight) return (await inflight).access_token;
  inflight = requestToken().then((t) => {
    cached = t;
    inflight = null;
    return t;
  });
  return (await inflight).access_token;
}

export class OpenEMRError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'OpenEMRError';
  }
}

type FetchOpts = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  isWrite?: boolean;
};

function buildUrl(base: string, path: string, query?: FetchOpts['query']): string {
  const url = new URL(base.replace(/\/$/, '') + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function apiFetch(base: string, path: string, opts: FetchOpts = {}): Promise<Response> {
  const method = opts.method ?? 'GET';
  const isWrite = opts.isWrite ?? method !== 'GET';
  if (isWrite && !allowWrites) {
    throw new OpenEMRError(403, `ALLOW_WRITES=false — refusing ${method} ${path}`);
  }

  const token = await getAccessToken();
  const res = await fetch(buildUrl(base, path, opts.query), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: base === env.OPENEMR_FHIR_URL ? 'application/fhir+json' : 'application/json',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers ?? {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });

  // If the token was invalidated (server restart, etc.) retry once.
  if (res.status === 401 && cached) {
    cached = null;
    const t = await getAccessToken();
    return fetch(buildUrl(base, path, opts.query), {
      method,
      headers: {
        Authorization: `Bearer ${t}`,
        Accept: base === env.OPENEMR_FHIR_URL ? 'application/fhir+json' : 'application/json',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.headers ?? {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    });
  }
  return res;
}

export async function restJson<T = unknown>(path: string, opts: FetchOpts = {}): Promise<T> {
  const res = await apiFetch(env.OPENEMR_API_URL, path, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new OpenEMRError(res.status, `REST ${opts.method ?? 'GET'} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json()) as any;
  // OpenEMR quirk: some endpoints return HTTP 200 with a `validationErrors` object
  // instead of the created record when the payload fails validation. Surface these.
  if (opts.method && opts.method !== 'GET' && json && typeof json === 'object') {
    const ve = (json as any).validationErrors;
    if (ve && ((Array.isArray(ve) && ve.length) || (typeof ve === 'object' && Object.keys(ve).length))) {
      throw new OpenEMRError(422, `REST ${opts.method} ${path} validation: ${JSON.stringify(ve)}`);
    }
  }
  return json as T;
}

export async function fhirJson<T = unknown>(path: string, opts: FetchOpts = {}): Promise<T> {
  const res = await apiFetch(env.OPENEMR_FHIR_URL, path, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new OpenEMRError(res.status, `FHIR ${opts.method ?? 'GET'} ${path} → ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

/** For quick smoke tests / debug endpoints. */
export function _resetTokenCacheForTests() {
  cached = null;
  inflight = null;
}
