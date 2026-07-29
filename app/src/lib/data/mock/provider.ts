import type { DataProvider } from '../provider';
import type {
  Appointment,
  AppointmentQuery,
  AppointmentStatus,
  Encounter,
  MedicalHistory,
  Patient,
  Practitioner,
  Slot,
} from '../types';

const availability: Practitioner['availability'] = [
  { dayOfWeek: 0, startTime: '09:00', endTime: '13:00', slotMinutes: 30 },
  { dayOfWeek: 1, startTime: '15:00', endTime: '19:00', slotMinutes: 30 },
  { dayOfWeek: 2, startTime: '09:00', endTime: '13:00', slotMinutes: 30 },
  { dayOfWeek: 3, startTime: '15:00', endTime: '19:00', slotMinutes: 30 },
  { dayOfWeek: 4, startTime: '09:00', endTime: '13:00', slotMinutes: 30 },
];

let practitioners: Practitioner[] = [
  ['mock-practitioner-1', 'Mariam', 'Al-Sabah', 'Obesity & bariatric surgery', 3000],
  ['mock-practitioner-2', 'Omar', 'Haddad', 'Gastroenterology, endoscopy & liver', 2500],
  ['mock-practitioner-3', 'Noor', 'Khalil', 'Clinical nutrition', 1800],
  ['mock-practitioner-4', 'Yousef', 'Rahman', 'Plastic & reconstructive surgery', 3000],
  ['mock-practitioner-5', 'Dana', 'Nasser', 'General & specialist surgery', 2500],
  ['mock-practitioner-6', 'Fahad', 'Saleh', 'Gastroenterology, endoscopy & liver', 2500],
].map(([id, firstName, lastName, specialty, fee]) => ({
  id: String(id),
  firstName: String(firstName),
  lastName: String(lastName),
  title: 'Dr.',
  specialty: String(specialty),
  bio: `Synthetic demonstration profile for ${specialty}.`,
  consultationFeeMinor: Number(fee),
  currency: 'KWD',
  active: true,
  availability: availability.map((rule) => ({ ...rule })),
}));

let patients: Patient[] = Array.from({ length: 25 }, (_, index) => ({
  id: `mock-patient-${index + 1}`,
  openemrPid: String(1000 + index),
  firstName: `Patient${index + 1}`,
  lastName: 'Synthetic',
  mobile: `+9655000${String(index).padStart(4, '0')}`,
  dateOfBirth: `${1970 + (index % 30)}-01-15`,
  sex: index % 2 ? 'female' : 'male',
  createdAt: '2026-01-01T08:00:00.000Z',
}));

let appointments: Appointment[] = [];
let sequence = 100;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function medicalHistory(patientId: string): MedicalHistory {
  return {
    problems: [{ label: 'Synthetic follow-up condition', active: true, onsetDate: '2025-10-01' }],
    allergies: [{ substance: 'No known drug allergies' }],
    medications: [{ name: 'Synthetic medication', dosage: 'Demo only', active: true }],
    vitals: [{ date: '2026-07-20T09:00:00.000Z', systolic: 118, diastolic: 76, pulse: 72 }],
    documents: [{ id: `document-${patientId}`, title: 'Synthetic visit summary', category: 'Visit summary', date: '2026-07-20T10:00:00.000Z' }],
  };
}

export const mockProvider: DataProvider = {
  async getPatients(query = {}) {
    const term = query.query?.trim().toLowerCase();
    let items = term
      ? patients.filter((patient) => `${patient.firstName} ${patient.lastName} ${patient.mobile}`.toLowerCase().includes(term))
      : patients;
    const total = items.length;
    items = items.slice(query.offset ?? 0, (query.offset ?? 0) + (query.limit ?? 50));
    return { items: clone(items), total };
  },
  async getPatientById(id) {
    return clone(patients.find((patient) => patient.id === id) ?? null);
  },
  async createPatient(data) {
    const patient: Patient = { ...data, id: `mock-patient-${++sequence}`, createdAt: new Date().toISOString() };
    patients.push(patient);
    return clone(patient);
  },
  async getPractitioners(query = {}) {
    let items = query.activeOnly === false ? practitioners : practitioners.filter((practitioner) => practitioner.active);
    if (query.specialty) items = items.filter((practitioner) => practitioner.specialty.toLowerCase().includes(query.specialty!.toLowerCase()));
    if (query.query) {
      const term = query.query.toLowerCase();
      items = items.filter((practitioner) => `${practitioner.firstName} ${practitioner.lastName} ${practitioner.specialty}`.toLowerCase().includes(term));
    }
    return clone(items);
  },
  async getPractitionerById(id) {
    return clone(practitioners.find((practitioner) => practitioner.id === id) ?? null);
  },
  async createPractitioner(data) {
    const practitioner: Practitioner = { ...data, id: `mock-practitioner-${++sequence}` };
    practitioners.push(practitioner);
    return clone(practitioner);
  },
  async updatePractitioner(id, data) {
    const index = practitioners.findIndex((practitioner) => practitioner.id === id);
    if (index < 0) throw new Error('Practitioner not found');
    practitioners[index] = { ...practitioners[index], ...data };
    return clone(practitioners[index]);
  },
  async setPractitionerActive(id, active) {
    const practitioner = practitioners.find((item) => item.id === id);
    if (!practitioner) throw new Error('Practitioner not found');
    practitioner.active = active;
  },
  async getAvailableSlots(practitionerId, from, to, slotMinutes) {
    const practitioner = practitioners.find((item) => item.id === practitionerId && item.active);
    if (!practitioner) return [];
    const slots: Slot[] = [];
    for (let cursor = new Date(`${from}T00:00:00.000Z`); cursor <= new Date(`${to}T00:00:00.000Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const date = cursor.toISOString().slice(0, 10);
      for (const rule of practitioner.availability.filter((item) => item.dayOfWeek === cursor.getUTCDay())) {
        const minutes = slotMinutes ?? rule.slotMinutes;
        const startOfDay = Date.parse(`${date}T${rule.startTime}:00.000Z`);
        const endOfDay = Date.parse(`${date}T${rule.endTime}:00.000Z`);
        for (let start = startOfDay; start + minutes * 60_000 <= endOfDay; start += minutes * 60_000) {
          const end = start + minutes * 60_000;
          const available = !appointments.some((appointment) => appointment.practitionerId === practitionerId && appointment.status !== 'cancelled' && Date.parse(appointment.start) < end && Date.parse(appointment.end) > start);
          slots.push({ practitionerId, start: new Date(start).toISOString(), end: new Date(end).toISOString(), available });
        }
      }
    }
    return slots;
  },
  async getAppointments(query: AppointmentQuery = {}) {
    let items = appointments;
    if (query.patientId) items = items.filter((item) => item.patientId === query.patientId);
    if (query.practitionerId) items = items.filter((item) => item.practitionerId === query.practitionerId);
    if (query.from) items = items.filter((item) => item.start.slice(0, 10) >= query.from!);
    if (query.to) items = items.filter((item) => item.start.slice(0, 10) <= query.to!);
    if (query.status) items = items.filter((item) => query.status!.includes(item.status));
    return clone(items);
  },
  async getAppointmentById(id) {
    return clone(appointments.find((appointment) => appointment.id === id) ?? null);
  },
  async createAppointment(data) {
    const practitioner = practitioners.find((item) => item.id === data.practitionerId);
    const patient = patients.find((item) => item.id === data.patientId);
    if (!practitioner || !patient) throw new Error('Patient or practitioner not found');
    const conflict = appointments.some((item) => item.practitionerId === data.practitionerId && item.status !== 'cancelled' && Date.parse(item.start) < Date.parse(data.end) && Date.parse(item.end) > Date.parse(data.start));
    if (conflict) throw new Error('Appointment slot is no longer available');
    const appointment: Appointment = { ...data, id: `mock-appointment-${++sequence}`, status: data.status ?? 'confirmed', patientName: `${patient.firstName} ${patient.lastName}`, practitionerName: `${practitioner.title} ${practitioner.firstName} ${practitioner.lastName}` };
    appointments.push(appointment);
    return clone(appointment);
  },
  async updateAppointmentStatus(id, status: AppointmentStatus) {
    const appointment = appointments.find((item) => item.id === id);
    if (!appointment) throw new Error('Appointment not found');
    appointment.status = status;
    return clone(appointment);
  },
  async getEncounters(query) {
    const patientId = query.patientId ?? patients[0].id;
    const encounters: Encounter[] = [{ id: `mock-encounter-${patientId}`, patientId, practitionerId: query.practitionerId ?? practitioners[0].id, date: '2026-07-20T10:00:00.000Z', reason: 'Synthetic follow-up', note: 'Synthetic clinical note for demonstration only.' }];
    return clone(encounters);
  },
  async getPatientMedicalHistory(patientId) {
    return clone(medicalHistory(patientId));
  },
};
