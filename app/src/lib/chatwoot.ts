import { env } from './env';

/**
 * Chatwoot (inbox.mawthook.io) client — sends OTP codes over WhatsApp via a
 * Chatwoot inbox connected to a WhatsApp channel. Chatwoot itself isn't a
 * message gateway; it proxies to whatever channel (WhatsApp Cloud API, a BSP,
 * etc.) the inbox is wired to. Outbound-first WhatsApp messages (no open 24h
 * session with the recipient) require a Meta-approved template — free-form
 * text will be rejected by WhatsApp regardless of what Chatwoot sends.
 *
 * Endpoint shapes below follow Chatwoot's public Application API
 * (https://www.chatwoot.com/developers/api/) as of this writing. Not yet
 * exercised against a live inbox/template — verify against the real account
 * once CHATWOOT_* env vars and an approved template are in place, and adjust
 * the request/response shape here if Chatwoot's actual behavior differs.
 */

export class ChatwootError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ChatwootError';
  }
}

function assertConfigured() {
  const missing = [
    ['CHATWOOT_BASE_URL', env.CHATWOOT_BASE_URL],
    ['CHATWOOT_ACCOUNT_ID', env.CHATWOOT_ACCOUNT_ID],
    ['CHATWOOT_API_TOKEN', env.CHATWOOT_API_TOKEN],
    ['CHATWOOT_WHATSAPP_INBOX_ID', env.CHATWOOT_WHATSAPP_INBOX_ID],
    ['CHATWOOT_OTP_TEMPLATE_NAME', env.CHATWOOT_OTP_TEMPLATE_NAME],
  ].filter(([, v]) => !v);
  if (missing.length) {
    throw new ChatwootError(500, `Chatwoot WhatsApp OTP not configured — missing ${missing.map(([k]) => k).join(', ')}`);
  }
}

async function chatwootFetch<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${env.CHATWOOT_BASE_URL.replace(/\/$/, '')}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      api_access_token: env.CHATWOOT_API_TOKEN,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ChatwootError(res.status, `Chatwoot ${opts.method ?? 'GET'} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Find the contact by phone number, creating one on the WhatsApp inbox if none exists. */
async function findOrCreateContact(mobile: string): Promise<number> {
  const search = await chatwootFetch<{ payload: { id: number; phone_number?: string }[] }>(
    `/api/v1/accounts/${env.CHATWOOT_ACCOUNT_ID}/contacts/search?q=${encodeURIComponent(mobile)}`,
  );
  const existing = search.payload?.find((c) => c.phone_number === mobile);
  if (existing) return existing.id;

  const created = await chatwootFetch<{ payload: { contact: { id: number } } }>(
    `/api/v1/accounts/${env.CHATWOOT_ACCOUNT_ID}/contacts`,
    {
      method: 'POST',
      body: { inbox_id: Number(env.CHATWOOT_WHATSAPP_INBOX_ID), phone_number: mobile, name: mobile },
    },
  );
  return created.payload.contact.id;
}

/**
 * Open (or reuse) a conversation on the WhatsApp inbox and send the OTP as a
 * template message — required for messaging outside an active 24h session.
 */
async function sendOtpTemplateMessage(contactId: number, code: string): Promise<void> {
  await chatwootFetch(`/api/v1/accounts/${env.CHATWOOT_ACCOUNT_ID}/conversations`, {
    method: 'POST',
    body: {
      inbox_id: Number(env.CHATWOOT_WHATSAPP_INBOX_ID),
      contact_id: contactId,
      status: 'open',
      message: {
        content: `${code} is your verification code.`,
        template_params: {
          name: env.CHATWOOT_OTP_TEMPLATE_NAME,
          category: 'AUTHENTICATION',
          language: env.CHATWOOT_OTP_TEMPLATE_LANG,
          processed_params: { '1': code },
        },
      },
    },
  });
}

/** Send a patient login OTP over WhatsApp via Chatwoot. Throws ChatwootError on any failure. */
export async function sendWhatsAppOtp(mobile: string, code: string): Promise<void> {
  assertConfigured();
  const contactId = await findOrCreateContact(mobile);
  await sendOtpTemplateMessage(contactId, code);
}
