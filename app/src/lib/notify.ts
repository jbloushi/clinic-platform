import { env } from './env';
import { logPrivateNote } from './chatwoot';
import { isWhatsAppConfigured, sendAppointmentReminder, sendBookingConfirmation } from './whatsapp';

/**
 * Patient notifications: send over WhatsApp, then annotate the agent inbox.
 *
 * These are fire-and-forget on purpose. A booking that succeeded must not be
 * reported as failed because a message didn't go out — the appointment is real
 * either way, and the confirmation screen already tells the patient what they
 * booked. Failures are logged for the server operator rather than surfaced.
 *
 * Nothing is sent unless WhatsApp is configured, so local and CI runs stay
 * silent without needing a separate mock mode.
 */

type VisitDetails = {
  mobile: string;
  patientName: string;
  doctorName: string;
  /** Already formatted for the patient's locale, e.g. "Tue, 4 Aug · 1:00 PM". */
  when: string;
  branchName: string;
};

export function notifyBookingConfirmed(details: VisitDetails): void {
  if (!isWhatsAppConfigured() || !env.WHATSAPP_BOOKING_TEMPLATE_NAME) return;
  void deliver(
    () => sendBookingConfirmation(details.mobile, details),
    details.mobile,
    `System sent a WhatsApp booking confirmation: ${details.doctorName}, ${details.when}, ${details.branchName}.`,
    'booking confirmation',
  );
}

export function notifyAppointmentReminder(details: VisitDetails): void {
  if (!isWhatsAppConfigured() || !env.WHATSAPP_REMINDER_TEMPLATE_NAME) return;
  void deliver(
    () => sendAppointmentReminder(details.mobile, details),
    details.mobile,
    `System sent a WhatsApp appointment reminder: ${details.doctorName}, ${details.when}, ${details.branchName}.`,
    'appointment reminder',
  );
}

async function deliver(
  send: () => Promise<void>,
  mobile: string,
  note: string,
  label: string,
): Promise<void> {
  try {
    await send();
  } catch (error) {
    console.error(`[notify] ${label} to ${mobile} failed:`, error);
    return; // Nothing was sent, so there is nothing to record for the agent.
  }
  await logPrivateNote(mobile, note);
}
