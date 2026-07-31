import { z } from 'zod';

const envSchema = z.object({
  APP_ENV: z.enum(['local', 'staging', 'production']).default('local'),
  USE_MOCK_DATA: z.enum(['true', 'false']).default('false'),
  ALLOW_WRITES: z.enum(['true', 'false']).default('true'),

  ADAPTER_DATABASE_URL: z.string().default('file:./prisma/dev.db'),
  AUTH_SESSION_SECRET: z.string().min(32).default('dev-only-secret-change-me-please-32chars'),
  OTP_MODE: z.enum(['mock', 'sms', 'whatsapp']).default('mock'),
  PAYMENTS_PROVIDER: z.enum(['mock', 'stripe', 'tap', 'hyperpay']).default('mock'),

  /** Shared secret for the scheduled-job routes under /api/cron/*. */
  CRON_SECRET: z.string().default(''),

  /**
   * Restrict doctors and slots to the branch the patient chose.
   *
   * Off by default: it only produces correct results once every practitioner is
   * assigned to a branch in /ops/branches and per-branch availability is set.
   * Enabled prematurely it empties doctor lists, so the switch stays separate
   * from the code that writes the branch onto a booking (which is always safe).
   */
  BRANCH_FILTERING_ENABLED: z.enum(['true', 'false']).default('false'),

  /** Shows the flag-gated /book/v2 link in the old booking entry point. */
  BOOKING_JOURNEY_V2_ENABLED: z.enum(['true', 'false']).default('false'),
  /** Whether the auto-assignment pool is used at all; off falls back to patient choice only. */
  AUTO_ASSIGNMENT_ENABLED: z.enum(['true', 'false']).default('true'),
  /** Whether /book/v2 gates finalization on payment. Off skips straight to EMR creation. */
  PAYMENT_FINALIZATION_ENABLED: z.enum(['true', 'false']).default('true'),

  // WhatsApp Cloud API — the actual delivery channel for OTPs, booking
  // confirmations and reminders. Chatwoot is not a gateway; it only receives a
  // private note afterwards so agents can see the history. See lib/whatsapp.ts.
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(''),
  WHATSAPP_ACCESS_TOKEN: z.string().default(''),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  WHATSAPP_OTP_TEMPLATE_NAME: z.string().default(''),
  WHATSAPP_BOOKING_TEMPLATE_NAME: z.string().default(''),
  WHATSAPP_REMINDER_TEMPLATE_NAME: z.string().default(''),
  WHATSAPP_TEMPLATE_LANG: z.string().default('en'),

  // Chatwoot (inbox.mawthook.io) — private-note logging only, so a human agent
  // picking up a conversation can see what the system already sent.
  CHATWOOT_BASE_URL: z.string().default(''),
  CHATWOOT_ACCOUNT_ID: z.string().default(''),
  CHATWOOT_API_TOKEN: z.string().default(''),
  CHATWOOT_WHATSAPP_INBOX_ID: z.string().default(''),
  CHATWOOT_OTP_TEMPLATE_NAME: z.string().default(''),
  CHATWOOT_OTP_TEMPLATE_LANG: z.string().default('en'),

  OPENEMR_BASE_URL: z.string().url().default('http://localhost/openemr'),
  OPENEMR_API_URL: z.string().url().default('http://localhost/openemr/apis/default/api'),
  OPENEMR_FHIR_URL: z.string().url().default('http://localhost/openemr/apis/default/fhir'),
  OPENEMR_OAUTH_TOKEN_URL: z.string().url().default('http://localhost/openemr/oauth2/default/token'),

  // Appointments carry OpenEMR's numeric facility and category ids. They differ
  // per install, so they're configuration rather than the constants they were.
  OPENEMR_FACILITY_ID: z.coerce.number().int().default(3),
  OPENEMR_APPOINTMENT_CATEGORY_ID: z.coerce.number().int().default(5),

  OPENEMR_GRANT_TYPE: z.enum(['password', 'client_credentials']).default('password'),
  OPENEMR_CLIENT_ID: z.string().default(''),
  OPENEMR_CLIENT_SECRET: z.string().default(''),
  OPENEMR_API_USERNAME: z.string().default(''),
  OPENEMR_API_PASSWORD: z.string().default(''),
  OPENEMR_SCOPES: z
    .string()
    .default(
      'openid api:oemr user/patient.cruds user/appointment.cruds user/practitioner.rs user/facility.rs user/encounter.rs api:fhir user/Patient.rs user/Practitioner.rs user/Appointment.rs user/Encounter.rs user/Condition.rs user/AllergyIntolerance.rs user/MedicationRequest.rs user/Observation.rs user/DocumentReference.rs'
    ),
});

export const env = envSchema.parse(process.env);
export const useMock = env.USE_MOCK_DATA === 'true';
export const allowWrites = env.ALLOW_WRITES === 'true';
export const branchFilteringEnabled = env.BRANCH_FILTERING_ENABLED === 'true';
export const bookingJourneyV2Enabled = env.BOOKING_JOURNEY_V2_ENABLED === 'true';
export const autoAssignmentEnabled = env.AUTO_ASSIGNMENT_ENABLED === 'true';
export const paymentFinalizationEnabled = env.PAYMENT_FINALIZATION_ENABLED === 'true';
