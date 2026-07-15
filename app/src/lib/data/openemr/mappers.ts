import type { Appointment, AppointmentStatus, Patient, Practitioner } from '../types';

/**
 * OpenEMR ↔ domain model mapping. Adjust as we learn more of the wire format
 * from the live instance (mappers are the ONLY place that talks OpenEMR's shapes).
 */

// -------- Patient (Standard REST /api/patient) --------

export interface OpenEMRPatientDto {
  uuid?: string;
  pid?: string | number;
  fname?: string;
  lname?: string;
  DOB?: string;
  sex?: string;
  phone_cell?: string;
  phone_home?: string;
  email?: string;
  street?: string;
  city?: string;
  state?: string;
}

export function toPatient(dto: OpenEMRPatientDto): Patient {
  return {
    id: dto.uuid ?? String(dto.pid ?? ''),
    openemrPid: dto.pid != null ? String(dto.pid) : undefined,
    firstName: dto.fname ?? '',
    lastName: dto.lname ?? '',
    dateOfBirth: dto.DOB || undefined,
    sex: normalizeSex(dto.sex),
    mobile: dto.phone_cell ?? dto.phone_home ?? '',
    email: dto.email || undefined,
    address: [dto.street, dto.city, dto.state].filter(Boolean).join(', ') || undefined,
  };
}

function normalizeSex(s?: string): Patient['sex'] {
  const v = (s ?? '').toLowerCase();
  if (v === 'male' || v === 'm') return 'male';
  if (v === 'female' || v === 'f') return 'female';
  if (v === 'other') return 'other';
  return 'unknown';
}

export function fromPatient(p: Partial<Patient>): OpenEMRPatientDto {
  return {
    fname: p.firstName,
    lname: p.lastName,
    // OpenEMR 8.0 requires DOB on POST. When the patient signs up online we don't
    // ask for it upfront — use a placeholder that reception can correct later.
    DOB: p.dateOfBirth || '1970-01-01',
    sex: p.sex ? p.sex[0].toUpperCase() + p.sex.slice(1) : 'Unknown',
    phone_cell: p.mobile,
    email: p.email,
    street: p.address,
  };
}

// -------- Practitioner (Standard REST /api/practitioner) --------

export interface OpenEMRPractitionerDto {
  uuid?: string;
  id?: string | number;
  fname?: string;
  lname?: string;
  mname?: string;
  title?: string;
  specialty?: string;
  npi?: string;
  federaltaxid?: string;
  federaldrugid?: string;
  upin?: string;
  facility_id?: string | number;
  facility?: string;
  physician_type?: string;
  email?: string;
  info?: string; // OpenEMR `users.info` — we use it to store the practitioner bio
  active?: boolean | number | string;
}

export function toPractitioner(dto: OpenEMRPractitionerDto): Practitioner {
  const active =
    dto.active === true || dto.active === 1 || dto.active === '1' || dto.active === 'true';
  return {
    id: dto.uuid ?? String(dto.id ?? ''),
    openemrNumericId: dto.id != null ? String(dto.id) : undefined,
    firstName: dto.fname ?? '',
    lastName: dto.lname ?? '',
    title: dto.title || 'Dr.',
    specialty: dto.specialty || 'General Practice',
    role: dto.physician_type || undefined,
    bio: dto.info || undefined,
    consultationFeeMinor: 15000,
    currency: 'USD',
    active,
    availability: [], // stored in platform DB; see providers repository
  };
}

export function fromPractitioner(
  p: Partial<Practitioner> & { npi?: string; email?: string },
): OpenEMRPractitionerDto {
  return {
    fname: p.firstName,
    lname: p.lastName,
    mname: '',
    title: p.title,
    specialty: p.specialty,
    // OpenEMR requires several id/tax fields even for demo — send empty strings
    // for the ones that don't apply and a synthetic NPI when one isn't provided.
    npi: p.npi ?? synthesizeNpi(p),
    federaltaxid: '',
    federaldrugid: '',
    upin: '',
    facility_id: '3',
    facility: 'Your Clinic Name',
    physician_type: '',
    email: p.email ?? '',
  };
}

function synthesizeNpi(p: Partial<Practitioner>): string {
  // Demo-only placeholder NPI. Production must collect a real one.
  const seed = `${p.firstName ?? ''}${p.lastName ?? ''}`;
  let n = 0;
  for (const ch of seed) n = (n * 31 + ch.charCodeAt(0)) & 0xffffff;
  return String(9_000_000_000 + (n % 999_999_999)).padStart(10, '9');
}

// -------- Appointment (Standard REST /api/appointment; table openemr_postcalendar_events) --------

export interface OpenEMRAppointmentDto {
  uuid?: string;
  id?: string | number;          // appointment create response uses this, not eid/pc_eid
  eid?: string | number;         // event id
  pc_eid?: string | number;
  pid?: string | number;
  pc_pid?: string | number;
  pc_aid?: string | number;      // provider id (user id)
  pc_eventDate?: string;         // YYYY-MM-DD
  pc_startTime?: string;         // HH:MM:SS
  pc_endTime?: string;
  pc_duration?: string | number; // seconds
  pc_hometext?: string;          // reason
  pc_apptstatus?: string;        // single-char code: '-' none, '*' arrived, etc.
  pc_title?: string;
}

export function toAppointment(dto: OpenEMRAppointmentDto): Appointment {
  const start = combineDateTime(dto.pc_eventDate, dto.pc_startTime);
  const end = combineDateTime(dto.pc_eventDate, dto.pc_endTime);
  return {
    id: String(dto.eid ?? dto.pc_eid ?? dto.id ?? dto.uuid ?? ''),
    patientId: String(dto.pid ?? dto.pc_pid ?? ''),
    practitionerId: String(dto.pc_aid ?? ''),
    start,
    end,
    status: mapApptStatus(dto.pc_apptstatus),
    reason: dto.pc_hometext || dto.pc_title || undefined,
  };
}

function combineDateTime(date?: string, time?: string): string {
  if (!date) return '';
  const t = time || '00:00:00';
  // Interpret as local time — OpenEMR stores calendar events in server local time
  return new Date(`${date}T${t}`).toISOString();
}

/**
 * OpenEMR status codes on `openemr_postcalendar_events.pc_apptstatus`:
 *   ""/"-" = none, "*" = pending confirm, "@" = arrived,
 *   ">" = in exam room, "$" = checked out, "?" = no show, "x" = cancelled
 * Our domain has more nuance (held, pending_payment, checked_in, completed).
 */
export function mapApptStatus(code?: string): AppointmentStatus {
  switch ((code ?? '').trim()) {
    case '':
    case '-':
      return 'confirmed';
    case '*':
      return 'pending_payment';
    case '@':
      return 'checked_in';
    case '>':
      return 'checked_in';
    case '$':
      return 'completed';
    case '?':
      return 'no_show';
    case 'x':
      return 'cancelled';
    default:
      return 'confirmed';
  }
}

export function toApptStatusCode(status: AppointmentStatus): string {
  switch (status) {
    case 'confirmed':
    case 'held':
    case 'draft':
      return '-';
    case 'pending_payment':
      return '*';
    case 'checked_in':
      return '@';
    case 'completed':
      return '$';
    case 'no_show':
      return '?';
    case 'cancelled':
      return 'x';
  }
}

export function splitDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    // OpenEMR appointment API validates pc_startTime as exactly 5 chars (HH:MM)
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}
