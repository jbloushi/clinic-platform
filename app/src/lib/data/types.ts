// Domain model — the single source of truth used by the UI.
// Both providers (Mock and OpenEMR) map their world into these types.

export type ISODate = string;      // "2026-07-05"
export type ISODateTime = string;  // "2026-07-05T09:30:00Z"

export type AppointmentStatus =
  | 'draft'
  | 'held'
  | 'pending_payment'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  draft: 'Draft',
  held: 'Held',
  pending_payment: 'Pending payment',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
};

export interface Patient {
  id: string;                       // OpenEMR uuid (or platform id in mock)
  openemrPid?: string;              // legacy numeric pid, if known
  firstName: string;
  lastName: string;
  mobile: string;
  email?: string;
  dateOfBirth?: ISODate;
  sex?: 'male' | 'female' | 'other' | 'unknown';
  address?: string;
  createdAt?: ISODateTime;
}

export interface Practitioner {
  id: string;                       // OpenEMR uuid
  openemrNumericId?: string;        // numeric user id (needed for pc_aid in appointment writes)
  firstName: string;
  lastName: string;
  title: string;                    // "Dr."
  specialty: string;
  bio?: string;
  photoUrl?: string;
  consultationFeeMinor: number;
  currency: string;
  active: boolean;
  availability: AvailabilityRule[];
}

export interface AvailabilityRule {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: string;                // "09:00"
  endTime: string;                  // "13:00"
  slotMinutes: number;
}

export interface Slot {
  practitionerId: string;
  start: ISODateTime;
  end: ISODateTime;
  available: boolean;
}

export interface Appointment {
  id: string;                       // OpenEMR event id
  patientId: string;                // OpenEMR patient uuid
  patientName?: string;
  practitionerId: string;
  practitionerName?: string;
  serviceId?: string;
  serviceName?: string;
  start: ISODateTime;
  end: ISODateTime;
  status: AppointmentStatus;
  reason?: string;
}

export interface Encounter {
  id: string;
  patientId: string;
  practitionerId: string;
  appointmentId?: string;
  date: ISODateTime;
  reason?: string;
  note?: string;
}

export interface MedicalHistory {
  problems: { code?: string; label: string; onsetDate?: ISODate; active: boolean }[];
  allergies: { substance: string; reaction?: string; severity?: string }[];
  medications: { name: string; dosage?: string; startDate?: ISODate; active: boolean }[];
  vitals: {
    date: ISODateTime;
    systolic?: number;
    diastolic?: number;
    pulse?: number;
    temperatureC?: number;
    heightCm?: number;
    weightKg?: number;
  }[];
  documents: { id: string; title: string; category: string; date: ISODateTime }[];
}

export interface Paged<T> {
  items: T[];
  total: number;
}

export interface PatientQuery { query?: string; limit?: number; offset?: number }
export interface PractitionerQuery { specialty?: string; activeOnly?: boolean; query?: string }
export interface AppointmentQuery {
  patientId?: string;
  practitionerId?: string;
  from?: ISODate;
  to?: ISODate;
  status?: AppointmentStatus[];
}
