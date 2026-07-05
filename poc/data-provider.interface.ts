/**
 * DataProvider contract — planning-phase proof.
 * Phase 1 moves this into app/src/lib/data/{types.ts, provider.ts} unchanged in spirit.
 * The UI imports repository functions only; it never knows whether data comes from
 * MockProvider or OpenEMRProvider (selected by USE_MOCK_DATA).
 */

// ---------- Domain types ----------

export type ISODate = string; // "2026-07-05"
export type ISODateTime = string; // "2026-07-05T09:30:00Z"

/** Booking status machine — DECISION_LOG D7 */
export type AppointmentStatus =
  | 'draft'
  | 'held'
  | 'pending_payment'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Patient {
  id: string; // platform id
  openemrUuid?: string; // mapping to OpenEMR patient_data uuid (Phase 2)
  firstName: string;
  lastName: string;
  mobile: string; // E.164
  email?: string;
  dateOfBirth: ISODate;
  sex: 'male' | 'female' | 'other' | 'unknown';
  address?: string;
  createdAt: ISODateTime;
}

export interface Practitioner {
  id: string;
  openemrUuid?: string;
  firstName: string;
  lastName: string;
  title: string; // "Dr."
  specialty: string; // "Cardiology"
  bio?: string;
  photoUrl?: string;
  consultationFee: number; // minor units of `currency`
  currency: string; // "USD" | "SAR" | ...
  active: boolean;
  /** Weekly availability template; used by slot computation (mock mode / P1). */
  availability: AvailabilityRule[];
}

export interface AvailabilityRule {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
  startTime: string; // "09:00"
  endTime: string; // "13:00"
  slotMinutes: number; // 15 | 20 | 30 ...
}

export interface Slot {
  practitionerId: string;
  start: ISODateTime;
  end: ISODateTime;
  serviceId?: string;
  available: boolean;
}

export interface Appointment {
  id: string;
  openemrEventId?: string; // pc_event id (Phase 2)
  patientId: string;
  practitionerId: string;
  serviceId: string;
  start: ISODateTime;
  end: ISODateTime;
  status: AppointmentStatus;
  reason?: string;
  createdAt: ISODateTime;
  /** e.g. hold expiry for the held → pending_payment window */
  holdExpiresAt?: ISODateTime;
}

export interface Service {
  id: string;
  name: string; // "New Consultation", "Follow-up Visit"
  durationMinutes: number;
  price: number; // minor units
  currency: string;
  active: boolean;
}

export interface Encounter {
  id: string;
  patientId: string;
  practitionerId: string;
  appointmentId?: string;
  date: ISODateTime;
  chiefComplaint?: string;
  note?: string; // clinical note (mock in P1)
  signed: boolean;
}

export interface MedicalHistory {
  problems: { code?: string; label: string; onsetDate?: ISODate; active: boolean }[];
  allergies: { substance: string; reaction?: string; severity?: 'mild' | 'moderate' | 'severe' }[];
  medications: { name: string; dosage?: string; startDate?: ISODate; active: boolean }[];
  vitals: {
    date: ISODateTime;
    heightCm?: number;
    weightKg?: number;
    systolic?: number;
    diastolic?: number;
    pulse?: number;
    temperatureC?: number;
  }[];
  labResults: { date: ISODateTime; test: string; value: string; unit?: string; flag?: 'normal' | 'high' | 'low' }[];
  documents: { id: string; title: string; category: string; date: ISODateTime; url?: string }[];
}

export interface Prescription {
  id: string;
  patientId: string;
  practitionerId: string;
  encounterId?: string;
  drug: string;
  dosage: string;
  instructions?: string;
  issuedAt: ISODateTime;
  active: boolean;
}

export interface Invoice {
  id: string;
  patientId: string;
  appointmentId?: string;
  items: { label: string; amount: number }[];
  total: number; // minor units
  currency: string;
  status: 'unpaid' | 'paid' | 'partially_paid' | 'refunded' | 'void';
  createdAt: ISODateTime;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: 'card_mock' | 'cash' | 'wallet' | 'transfer';
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  createdAt: ISODateTime;
}

/** Wallet is an append-only ledger; balance is always derived — DECISION_LOG D6 */
export interface WalletTransaction {
  id: string;
  patientId: string;
  amount: number; // positive = credit, negative = debit (minor units)
  source: 'consultation_credit' | 'promo' | 'admin_adjustment' | 'payment' | 'refund' | 'expiry';
  reference?: string; // invoiceId / appointmentId / note
  expiresAt?: ISODateTime; // for expiring credits
  createdAt: ISODateTime;
  createdBy: string; // user id or "system"
}

export interface Wallet {
  patientId: string;
  balance: number; // derived from ledger
  currency: string;
  transactions: WalletTransaction[];
}

// ---------- Query params ----------

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PatientQuery {
  query?: string;
  page?: number;
  pageSize?: number;
}

export interface AppointmentQuery {
  patientId?: string;
  practitionerId?: string;
  from?: ISODate;
  to?: ISODate;
  status?: AppointmentStatus[];
}

export interface PractitionerQuery {
  specialty?: string;
  activeOnly?: boolean;
  query?: string;
}

// ---------- The provider contract ----------

export interface DataProvider {
  // Patients
  getPatients(q?: PatientQuery): Promise<Paged<Patient>>;
  getPatientById(id: string): Promise<Patient | null>;
  createPatient(data: Omit<Patient, 'id' | 'createdAt'>): Promise<Patient>;

  // Practitioners
  getPractitioners(q?: PractitionerQuery): Promise<Practitioner[]>;
  getPractitionerById(id: string): Promise<Practitioner | null>;

  // Scheduling
  getAvailableSlots(practitionerId: string, from: ISODate, to: ISODate, serviceId?: string): Promise<Slot[]>;
  getAppointments(q?: AppointmentQuery): Promise<Appointment[]>;
  getAppointmentById(id: string): Promise<Appointment | null>;
  createAppointment(data: {
    patientId: string;
    practitionerId: string;
    serviceId: string;
    start: ISODateTime;
    reason?: string;
  }): Promise<Appointment>; // creates in `held` status
  updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<Appointment>;

  // Clinical (read paths; writes are mock-only in Phase 1)
  getEncounters(q: { patientId?: string; practitionerId?: string }): Promise<Encounter[]>;
  getPatientMedicalHistory(patientId: string): Promise<MedicalHistory>;
  getPrescriptions(q: { patientId?: string; practitionerId?: string }): Promise<Prescription[]>;

  // Catalog & billing
  getServices(): Promise<Service[]>;
  getInvoices(q: { patientId?: string; status?: Invoice['status'] }): Promise<Invoice[]>;

  // Wallet (always platform DB, both providers delegate to the same service)
  getWallet(patientId: string): Promise<Wallet>;
}

// ---------- Compile-time proof that the contract is implementable ----------

export function createProvider(useMock: boolean, impls: { mock: DataProvider; openemr: DataProvider }): DataProvider {
  return useMock ? impls.mock : impls.openemr;
}
