import { env } from './env';

/**
 * WhatsApp Cloud API client — the actual delivery channel for patient messages.
 *
 * Chatwoot is deliberately not in this path. It is an agent inbox, not a
 * gateway: routing outbound traffic through it adds a hop that can fail on its
 * own, and makes automated sends indistinguishable from an agent typing. So the
 * message goes to Meta directly here, and Chatwoot receives a private note
 * afterwards (see lib/chatwoot.ts) purely so a human picking up the
 * conversation can see what the system already sent.
 *
 * Every outbound-initiated message must be a Meta-approved template. WhatsApp
 * rejects free-form text outside an open 24-hour customer service window
 * regardless of what we send, so there is no plain-text fallback to offer.
 */

export class WhatsAppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'WhatsAppError';
  }
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN);
}

function assertConfigured(templateName: string, templateEnvVar: string) {
  const missing = [
    ['WHATSAPP_PHONE_NUMBER_ID', env.WHATSAPP_PHONE_NUMBER_ID],
    ['WHATSAPP_ACCESS_TOKEN', env.WHATSAPP_ACCESS_TOKEN],
    [templateEnvVar, templateName],
  ].filter(([, value]) => !value);
  if (missing.length) {
    throw new WhatsAppError(
      500,
      `WhatsApp Cloud API not configured — missing ${missing.map(([k]) => k).join(', ')}`,
    );
  }
}

/**
 * Meta wants a plain international number: digits only, no '+', no separators.
 */
function toWaId(mobile: string): string {
  return mobile.replace(/\D/g, '');
}

async function sendTemplate(
  mobile: string,
  templateName: string,
  bodyParams: string[],
): Promise<void> {
  const url = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toWaId(mobile),
      type: 'template',
      template: {
        name: templateName,
        language: { code: env.WHATSAPP_TEMPLATE_LANG },
        components: bodyParams.length
          ? [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) }]
          : undefined,
      },
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new WhatsAppError(res.status, `WhatsApp send failed (${res.status}): ${detail}`);
  }
}

/**
 * One-time login code.
 *
 * Authentication templates take the code as their single body parameter, and
 * Meta requires the button parameter to repeat it when the template has a
 * copy-code button — we send body-only, so the template must be registered
 * without one.
 */
export async function sendOtp(mobile: string, code: string): Promise<void> {
  assertConfigured(env.WHATSAPP_OTP_TEMPLATE_NAME, 'WHATSAPP_OTP_TEMPLATE_NAME');
  await sendTemplate(mobile, env.WHATSAPP_OTP_TEMPLATE_NAME, [code]);
}

/** Booking confirmation: who, when, where. */
export async function sendBookingConfirmation(
  mobile: string,
  details: { patientName: string; doctorName: string; when: string; branchName: string },
): Promise<void> {
  assertConfigured(env.WHATSAPP_BOOKING_TEMPLATE_NAME, 'WHATSAPP_BOOKING_TEMPLATE_NAME');
  await sendTemplate(mobile, env.WHATSAPP_BOOKING_TEMPLATE_NAME, [
    details.patientName,
    details.doctorName,
    details.when,
    details.branchName,
  ]);
}

/** Day-before reminder for an upcoming visit. */
export async function sendAppointmentReminder(
  mobile: string,
  details: { patientName: string; doctorName: string; when: string; branchName: string },
): Promise<void> {
  assertConfigured(env.WHATSAPP_REMINDER_TEMPLATE_NAME, 'WHATSAPP_REMINDER_TEMPLATE_NAME');
  await sendTemplate(mobile, env.WHATSAPP_REMINDER_TEMPLATE_NAME, [
    details.patientName,
    details.doctorName,
    details.when,
    details.branchName,
  ]);
}
