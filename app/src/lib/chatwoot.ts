import { env } from './env';

/**
 * Chatwoot (inbox.mawthook.io) — agent-visibility only.
 *
 * Chatwoot does not send anything here. Patient messages go out through the
 * WhatsApp Cloud API (see lib/whatsapp.ts); this module writes a *private note*
 * onto the patient's conversation recording what was sent. Private notes are
 * invisible to the patient, so an agent who later picks up the thread can see
 * that a code or a confirmation already went out — and not repeat it — without
 * the log itself becoming another message the patient receives.
 *
 * Everything here is best-effort by design: failing to annotate a conversation
 * must never fail the operation it describes. Callers use `logPrivateNote`,
 * which swallows its own errors.
 *
 * Endpoint shapes follow Chatwoot's public Application API
 * (https://www.chatwoot.com/developers/api/).
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

export function isChatwootConfigured(): boolean {
  return Boolean(
    env.CHATWOOT_BASE_URL &&
      env.CHATWOOT_ACCOUNT_ID &&
      env.CHATWOOT_API_TOKEN &&
      env.CHATWOOT_WHATSAPP_INBOX_ID,
  );
}

async function chatwootFetch<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
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
 * Reuse this contact's open conversation on the WhatsApp inbox, or start one.
 *
 * Reuse matters: a new conversation per note would fragment the patient's
 * history across dozens of threads, which is the opposite of what the note is
 * for.
 */
async function findOrCreateConversation(contactId: number): Promise<number> {
  const existing = await chatwootFetch<{ payload: { id: number; inbox_id: number; status: string }[] }>(
    `/api/v1/accounts/${env.CHATWOOT_ACCOUNT_ID}/contacts/${contactId}/conversations`,
  ).catch(() => null);

  const inboxId = Number(env.CHATWOOT_WHATSAPP_INBOX_ID);
  const open = existing?.payload?.find((c) => c.inbox_id === inboxId && c.status !== 'resolved');
  if (open) return open.id;

  const created = await chatwootFetch<{ id: number }>(
    `/api/v1/accounts/${env.CHATWOOT_ACCOUNT_ID}/conversations`,
    {
      method: 'POST',
      body: { inbox_id: inboxId, contact_id: contactId, status: 'open' },
    },
  );
  return created.id;
}

/**
 * Record on the patient's Chatwoot conversation what the system just sent them.
 *
 * `private: true` is what keeps this an internal annotation rather than an
 * outbound message — without it Chatwoot would deliver the text to the patient,
 * duplicating whatever WhatsApp already sent.
 *
 * Never include the OTP itself: the note exists so an agent knows a code was
 * sent, not so they can read it.
 */
export async function logPrivateNote(mobile: string, note: string): Promise<void> {
  if (!isChatwootConfigured()) return;
  try {
    const contactId = await findOrCreateContact(mobile);
    const conversationId = await findOrCreateConversation(contactId);
    await chatwootFetch(
      `/api/v1/accounts/${env.CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: { content: note, message_type: 'outgoing', private: true },
      },
    );
  } catch {
    // Agent visibility is a convenience, not a requirement of the send. The
    // caller has already delivered the message that matters.
  }
}
