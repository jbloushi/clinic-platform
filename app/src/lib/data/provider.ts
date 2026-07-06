import type {
  Appointment,
  AppointmentQuery,
  AppointmentStatus,
  Encounter,
  ISODate,
  ISODateTime,
  MedicalHistory,
  Paged,
  Patient,
  PatientQuery,
  Practitioner,
  PractitionerQuery,
  Slot,
} from './types';

export interface DataProvider {
  // Patients
  getPatients(q?: PatientQuery): Promise<Paged<Patient>>;
  getPatientById(id: string): Promise<Patient | null>;
  createPatient(data: Omit<Patient, 'id' | 'createdAt'>): Promise<Patient>;

  // Practitioners
  getPractitioners(q?: PractitionerQuery): Promise<Practitioner[]>;
  getPractitionerById(id: string): Promise<Practitioner | null>;
  createPractitioner(data: Omit<Practitioner, 'id'> & { npi?: string; email?: string }): Promise<Practitioner>;

  // Scheduling
  getAvailableSlots(
    practitionerId: string,
    from: ISODate,
    to: ISODate,
    slotMinutes?: number,
  ): Promise<Slot[]>;
  getAppointments(q?: AppointmentQuery): Promise<Appointment[]>;
  getAppointmentById(id: string): Promise<Appointment | null>;
  createAppointment(data: {
    patientId: string;
    practitionerId: string;
    start: ISODateTime;
    end: ISODateTime;
    reason?: string;
    status?: AppointmentStatus;
  }): Promise<Appointment>;
  updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<Appointment>;

  // Clinical (reads)
  getEncounters(q: { patientId?: string; practitionerId?: string }): Promise<Encounter[]>;
  getPatientMedicalHistory(patientId: string): Promise<MedicalHistory>;
}
