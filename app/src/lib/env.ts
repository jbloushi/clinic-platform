import { z } from 'zod';

const envSchema = z.object({
  APP_ENV: z.enum(['local', 'staging', 'production']).default('local'),
  USE_MOCK_DATA: z.enum(['true', 'false']).default('false'),
  ALLOW_WRITES: z.enum(['true', 'false']).default('true'),

  ADAPTER_DATABASE_URL: z.string().default('file:./prisma/dev.db'),
  AUTH_SESSION_SECRET: z.string().min(32).default('dev-only-secret-change-me-please-32chars'),
  OTP_MODE: z.enum(['mock', 'sms']).default('mock'),
  PAYMENTS_PROVIDER: z.enum(['mock', 'stripe', 'tap', 'hyperpay']).default('mock'),

  OPENEMR_BASE_URL: z.string().url().default('http://localhost/openemr'),
  OPENEMR_API_URL: z.string().url().default('http://localhost/openemr/apis/default/api'),
  OPENEMR_FHIR_URL: z.string().url().default('http://localhost/openemr/apis/default/fhir'),
  OPENEMR_OAUTH_TOKEN_URL: z.string().url().default('http://localhost/openemr/oauth2/default/token'),

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
