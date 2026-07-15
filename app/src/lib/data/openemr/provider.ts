import type { DataProvider } from '../provider';
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
} from '../types';
import { fhirJson, restJson } from './client';
import {
  fromPatient,
  fromPractitioner,
  splitDateTime,
  toAppointment,
  toApptStatusCode,
  toPatient,
  toPractitioner,
  type OpenEMRAppointmentDto,
  type OpenEMRPatientDto,
  type OpenEMRPractitionerDto,
} from './mappers';
import { computeAvailableSlots, generateSlotsFromBooked } from './slots';
import { getBookingCountsSince, getPractitionerAvailability, getServiceSpecialistUuids } from '../platform-repo';

/**
 * Real OpenEMR-backed provider. All calls go through the OAuth2-authenticated client.
 * Server-side only — never import from a client component.
 */
export const openemrProvider: DataProvider = {
  // -------- Patients --------
  async getPatients(q: PatientQuery = {}): Promise<Paged<Patient>> {
    const raw = await restJson<any>('/patient', {
      query: { fname: q.query, limit: q.limit ?? 50, offset: q.offset ?? 0 },
    });
    const arr = extractArray<OpenEMRPatientDto>(raw);
    return { items: arr.map(toPatient), total: arr.length };
  },

  async getPatientById(id: string): Promise<Patient | null> {
    try {
      const raw = await restJson<any>(`/patient/${encodeURIComponent(id)}`);
      const dto = raw?.data ?? raw;
      return dto ? toPatient(dto as OpenEMRPatientDto) : null;
    } catch (e: any) {
      if (e?.status === 404) return null;
      throw e;
    }
  },

  async createPatient(data: Omit<Patient, 'id' | 'createdAt'>): Promise<Patient> {
    const res = await restJson<any>('/patient', { method: 'POST', body: fromPatient(data) });
    const dto = (res?.data ?? res) as OpenEMRPatientDto;
    return toPatient(dto);
  },

  // -------- Practitioners --------
  async getPractitioners(q: PractitionerQuery = {}): Promise<Practitioner[]> {
    const raw = await restJson<any>('/practitioner');
    const arr = extractArray<OpenEMRPractitionerDto>(raw);
    let mapped = arr.map(toPractitioner);
    if (q.activeOnly !== false) mapped = mapped.filter((p) => p.active);
    if (q.specialty) mapped = mapped.filter((p) => p.specialty.toLowerCase().includes(q.specialty!.toLowerCase()));
    if (q.query) {
      const s = q.query.toLowerCase();
      mapped = mapped.filter((p) =>
        `${p.firstName} ${p.lastName} ${p.specialty}`.toLowerCase().includes(s),
      );
    }
    // enrich with availability from platform DB
    return Promise.all(
      mapped.map(async (p) => ({ ...p, availability: await getPractitionerAvailability(p.id) })),
    );
  },

  async getPractitionerById(id: string): Promise<Practitioner | null> {
    try {
      const raw = await restJson<any>(`/practitioner/${encodeURIComponent(id)}`);
      const dto = raw?.data ?? raw;
      if (!dto) return null;
      const p = toPractitioner(dto as OpenEMRPractitionerDto);
      p.availability = await getPractitionerAvailability(p.id);
      return p;
    } catch (e: any) {
      if (e?.status === 404) return null;
      throw e;
    }
  },

  async createPractitioner(data: Omit<Practitioner, 'id'> & { npi?: string; email?: string }): Promise<Practitioner> {
    const res = await restJson<any>('/practitioner', { method: 'POST', body: fromPractitioner(data) });
    const dto = (res?.data ?? res) as OpenEMRPractitionerDto;
    const created = toPractitioner(dto);

    // Compensate for OpenEMR 8.0 REST gap: mark the user authorized + set a username
    // so they show up in subsequent GET /api/practitioner queries.
    if (created.id) {
      const username = `doc_${data.firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${created.id.slice(0, 6)}`;
      const { authorizePractitioner } = await import('./emr-db');
      await authorizePractitioner(created.id, { username }).catch(() => false);
    }
    return created;
  },

  async updatePractitioner(
    id: string,
    data: Partial<Pick<Practitioner, 'firstName' | 'lastName' | 'title' | 'specialty' | 'bio' | 'role'>> & {
      npi?: string;
    },
  ): Promise<Practitioner> {
    const current = await openemrProvider.getPractitionerById(id);
    if (!current) throw new Error(`Practitioner ${id} not found`);
    const merged = { ...current, ...data };
    const res = await restJson<any>(`/practitioner/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: fromPractitioner(merged),
    });
    const dto = (res?.data ?? res) as OpenEMRPractitionerDto;
    const updated = toPractitioner(dto);
    updated.availability = current.availability;
    return updated;
  },

  async setPractitionerActive(id: string, active: boolean): Promise<void> {
    // OpenEMR's REST practitioner endpoint doesn't reliably expose `active`
    // as a writable field — same REST gap createPractitioner already works
    // around via the direct-DB shim for `authorized`.
    const { setPractitionerActive } = await import('./emr-db');
    await setPractitionerActive(id, active);
  },

  // -------- Scheduling --------
  async getAvailableSlots(
    practitionerId: string,
    from: ISODate,
    to: ISODate,
    slotMinutes?: number,
  ): Promise<Slot[]> {
    const [availability, numericId] = await Promise.all([
      getPractitionerAvailability(practitionerId),
      resolvePractitionerNumericId(practitionerId),
    ]);
    return computeAvailableSlots(practitionerId, availability, from, to, slotMinutes, numericId);
  },

  async getAppointments(q: AppointmentQuery = {}): Promise<Appointment[]> {
    const [pracMap, patMap] = await Promise.all([getPractitionerMaps(), getPatientMaps()]);

    const query: Record<string, string> = {};
    if (q.patientId) {
      // Accept a uuid or a numeric pid for the filter.
      query.pid = /^\d+$/.test(q.patientId) ? q.patientId : patMap.byUuid.get(q.patientId) ?? q.patientId;
    }
    if (q.practitionerId) {
      // Appointments store the NUMERIC provider id (pc_aid); callers pass a uuid.
      query.pc_aid = /^\d+$/.test(q.practitionerId)
        ? q.practitionerId
        : pracMap.byUuid.get(q.practitionerId) ?? q.practitionerId;
    }
    if (q.from) query.date_start = q.from;
    if (q.to) query.date_end = q.to;

    const raw = await restJson<any>('/appointment', { query });
    const arr = extractArray<OpenEMRAppointmentDto>(raw);
    let items = arr.map(toAppointment).map((a) => enrichAppointment(a, pracMap, patMap));

    // OpenEMR's /api/appointment ignores date_start/date_end — filter locally so
    // day/range views are correct. Compare on the calendar date (local).
    if (q.from) items = items.filter((a) => a.start.slice(0, 10) >= q.from!);
    if (q.to) items = items.filter((a) => a.start.slice(0, 10) <= q.to!);
    // Same for the practitioner filter, in case OpenEMR returned extras.
    if (q.practitionerId) {
      const numeric = /^\d+$/.test(q.practitionerId) ? q.practitionerId : pracMap.byUuid.get(q.practitionerId);
      const uuid = /^\d+$/.test(q.practitionerId) ? pracMap.byNumeric.get(q.practitionerId)?.uuid : q.practitionerId;
      items = items.filter((a) => a.practitionerId === uuid || a.practitionerId === numeric);
    }
    if (q.status && q.status.length) items = items.filter((a) => q.status!.includes(a.status));
    return items;
  },

  async getAppointmentById(id: string): Promise<Appointment | null> {
    try {
      const raw = await restJson<any>(`/appointment/${encodeURIComponent(id)}`);
      const dto = raw?.data ?? raw;
      if (!dto) return null;
      const [pracMap, patMap] = await Promise.all([getPractitionerMaps(), getPatientMaps()]);
      return enrichAppointment(toAppointment(dto as OpenEMRAppointmentDto), pracMap, patMap);
    } catch (e: any) {
      if (e?.status === 404) return null;
      throw e;
    }
  },

  async createAppointment(data: {
    patientId: string;
    practitionerId: string;
    start: ISODateTime;
    end: ISODateTime;
    reason?: string;
    status?: AppointmentStatus;
  }): Promise<Appointment> {
    const startParts = splitDateTime(data.start);
    const endParts = splitDateTime(data.end);
    const durSec = Math.round((+new Date(data.end) - +new Date(data.start)) / 1000);

    // OpenEMR's appointment endpoint requires numeric ids (pc_aid for the provider,
    // and pid for the patient in the body — even though the patient uuid is already
    // in the URL). Look both up.
    const [practitionerNumericId, patientNumericId] = await Promise.all([
      resolvePractitionerNumericId(data.practitionerId),
      resolvePatientNumericId(data.patientId),
    ]);

    const body = {
      pc_eventDate: startParts.date,
      pc_startTime: startParts.time,
      pc_endTime: endParts.time,
      pc_duration: durSec,
      pc_aid: practitionerNumericId,
      pid: patientNumericId,
      pc_pid: patientNumericId,
      pc_apptstatus: toApptStatusCode(data.status ?? 'confirmed'),
      pc_hometext: data.reason ?? '',
      pc_title: data.reason ?? 'Consultation',
      pc_catid: 5,
      pc_facility: 3,
      pc_billing_location: 3,
    };

    const res = await restJson<any>(`/patient/${encodeURIComponent(patientNumericId)}/appointment`, {
      method: 'POST',
      body,
    });
    const dto = (res?.data ?? res) as OpenEMRAppointmentDto;
    return toAppointment({
      ...dto,
      pc_eventDate: startParts.date,
      pc_startTime: startParts.time,
      pc_endTime: endParts.time,
      pc_aid: data.practitionerId,
      pid: data.patientId,
      pc_apptstatus: body.pc_apptstatus,
      pc_hometext: data.reason ?? '',
    });
  },

  async updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<Appointment> {
    await restJson<any>(`/appointment/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: { pc_apptstatus: toApptStatusCode(status) },
    });
    const raw = await restJson<any>(`/appointment/${encodeURIComponent(id)}`);
    return toAppointment((raw?.data ?? raw) as OpenEMRAppointmentDto);
  },

  // -------- Clinical (FHIR reads) --------
  async getEncounters({ patientId }: { patientId?: string; practitionerId?: string }): Promise<Encounter[]> {
    if (!patientId) return [];
    const bundle = await fhirJson<any>(`/Encounter`, { query: { patient: patientId } });
    return (bundle?.entry ?? []).map((e: any): Encounter => {
      const r = e.resource;
      return {
        id: r.id,
        patientId,
        practitionerId: r.participant?.[0]?.individual?.reference?.split('/').pop() ?? '',
        date: r.period?.start ?? '',
        reason: r.reasonCode?.[0]?.text,
      };
    });
  },

  async getPatientMedicalHistory(patientId: string): Promise<MedicalHistory> {
    const empty: MedicalHistory = { problems: [], allergies: [], medications: [], vitals: [], documents: [] };
    if (!patientId) return empty;

    const [problems, allergies, meds, obs, docs] = await Promise.all([
      fhirJson<any>('/Condition', { query: { patient: patientId } }).catch(() => null),
      fhirJson<any>('/AllergyIntolerance', { query: { patient: patientId } }).catch(() => null),
      fhirJson<any>('/MedicationRequest', { query: { patient: patientId } }).catch(() => null),
      fhirJson<any>('/Observation', { query: { patient: patientId, category: 'vital-signs' } }).catch(() => null),
      fhirJson<any>('/DocumentReference', { query: { patient: patientId } }).catch(() => null),
    ]);

    return {
      problems: (problems?.entry ?? []).map((e: any) => ({
        code: e.resource?.code?.coding?.[0]?.code,
        label: e.resource?.code?.text ?? e.resource?.code?.coding?.[0]?.display ?? 'Problem',
        onsetDate: e.resource?.onsetDateTime,
        active: e.resource?.clinicalStatus?.coding?.[0]?.code === 'active',
      })),
      allergies: (allergies?.entry ?? []).map((e: any) => ({
        substance: e.resource?.code?.text ?? e.resource?.code?.coding?.[0]?.display ?? 'Allergen',
        reaction: e.resource?.reaction?.[0]?.manifestation?.[0]?.text,
        severity: e.resource?.reaction?.[0]?.severity,
      })),
      medications: (meds?.entry ?? []).map((e: any) => ({
        name: e.resource?.medicationCodeableConcept?.text ?? 'Medication',
        dosage: e.resource?.dosageInstruction?.[0]?.text,
        active: e.resource?.status === 'active',
      })),
      vitals: (obs?.entry ?? []).slice(0, 20).map((e: any) => ({
        date: e.resource?.effectiveDateTime ?? '',
        // components may include systolic/diastolic; simplistic mapping
        systolic: undefined,
        diastolic: undefined,
      })),
      documents: (docs?.entry ?? []).map((e: any) => ({
        id: e.resource?.id,
        title: e.resource?.description ?? e.resource?.type?.text ?? 'Document',
        category: e.resource?.category?.[0]?.coding?.[0]?.display ?? 'Other',
        date: e.resource?.date ?? '',
      })),
    };
  },
};

// ----------------------------------------------------------------------------
// Specialists program (Phase 3): auto-assign a specialist by service +
// availability. Standalone exports (not part of the generic DataProvider
// interface) since these are OpenEMR-specific batch/eligibility helpers.
// ----------------------------------------------------------------------------

/**
 * Eligible specialist UUIDs for a service: the raw service<->specialist join
 * (Phase 2) if any rows exist, otherwise every active specialist (the "any
 * specialist" fallback).
 */
export async function getEligibleSpecialistUuids(serviceId: string): Promise<string[]> {
  const raw = await getServiceSpecialistUuids(serviceId);
  if (raw.length > 0) return raw;
  const all = await openemrProvider.getPractitioners({ activeOnly: true });
  return all.map((p) => p.id);
}

/**
 * Free slots for many specialists across [from, to] with a SINGLE OpenEMR
 * appointments fetch (not one per specialist). OpenEMR ignores the
 * pc_aid/date_start/date_end filters server-side regardless of what's passed,
 * so one unfiltered-in-practice fetch already contains every specialist's
 * appointments — computeAvailableSlots calling itself once per doctor was
 * doing this same full fetch N times for no benefit.
 */
export async function getAvailableSlotsBulk(
  specialistUuids: string[],
  from: ISODate,
  to: ISODate,
  overrideSlotMinutes?: number,
): Promise<Record<string, Slot[]>> {
  const pracMap = await getPractitionerMaps();

  let items: Appointment[] = [];
  try {
    const raw = await restJson<any>('/appointment', { query: { date_start: from, date_end: to } });
    items = extractArray<OpenEMRAppointmentDto>(raw)
      .map(toAppointment)
      .filter((a) => a.status !== 'cancelled')
      // OpenEMR ignores the date filter — enforce it locally (same as getAppointments).
      .filter((a) => a.start.slice(0, 10) >= from && a.start.slice(0, 10) <= to);
  } catch {
    items = []; // fail open — an empty booked list just means "show all slots as free"
  }

  const bookedByUuid = new Map<string, { start: number; end: number }[]>();
  for (const a of items) {
    const uuid = pracMap.byNumeric.get(a.practitionerId)?.uuid ?? a.practitionerId;
    const arr = bookedByUuid.get(uuid) ?? [];
    arr.push({ start: +new Date(a.start), end: +new Date(a.end) });
    bookedByUuid.set(uuid, arr);
  }

  const result: Record<string, Slot[]> = {};
  await Promise.all(
    specialistUuids.map(async (uuid) => {
      const availability = await getPractitionerAvailability(uuid);
      result[uuid] = generateSlotsFromBooked(uuid, availability, from, to, bookedByUuid.get(uuid) ?? [], overrideSlotMinutes);
    }),
  );
  return result;
}

/**
 * Rank eligible specialists for a specific [startIso, endIso) slot:
 * least-loaded first (fewest confirmed bookings in the last 30 days), ties
 * broken by UUID for a reproducible result, filtered to those OpenEMR shows
 * as free for this slot right now (not the possibly-stale slot list the
 * patient saw). Returns the full ordered list, not just the first pick —
 * the booking route walks it as a fallback chain: the real serialization
 * happens at the BookingHold unique-constraint gate, so if our top pick
 * loses that race to a concurrent request, the route retries the next
 * candidate here instead of giving up.
 *
 * Fetches the target day's appointments ONCE (same fetch-once-partition-many
 * pattern as getAvailableSlotsBulk) rather than once per candidate — with a
 * large eligible pool ("any specialist" services can have 8+), a per-
 * candidate fetch loop turned booking confirmation into a multi-second wait.
 */
export async function rankSpecialistsForSlot(
  eligibleUuids: string[],
  startIso: ISODateTime,
  endIso: ISODateTime,
): Promise<string[]> {
  if (eligibleUuids.length === 0) return [];

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const [counts, pracMap] = await Promise.all([getBookingCountsSince(eligibleUuids, since), getPractitionerMaps()]);
  const ordered = [...eligibleUuids].sort((a, b) => {
    const ca = counts.get(a) ?? 0;
    const cb = counts.get(b) ?? 0;
    if (ca !== cb) return ca - cb;
    return a.localeCompare(b);
  });

  const day = startIso.slice(0, 10);
  const startMs = +new Date(startIso);
  const endMs = +new Date(endIso);

  let items: Appointment[] = [];
  try {
    const raw = await restJson<any>('/appointment', { query: { date_start: day, date_end: day } });
    items = extractArray<OpenEMRAppointmentDto>(raw)
      .map(toAppointment)
      .filter((a) => a.status !== 'cancelled' && a.start.slice(0, 10) === day);
  } catch {
    items = []; // fail open — treating every candidate as free when the read fails is
    // safer than blocking every booking; the BookingHold unique-constraint gate and
    // createAppointment's own OpenEMR-side write still reject a genuine conflict.
  }

  const bookedByUuid = new Map<string, { start: number; end: number }[]>();
  for (const a of items) {
    const uuid = pracMap.byNumeric.get(a.practitionerId)?.uuid ?? a.practitionerId;
    const arr = bookedByUuid.get(uuid) ?? [];
    arr.push({ start: +new Date(a.start), end: +new Date(a.end) });
    bookedByUuid.set(uuid, arr);
  }

  return ordered.filter((uuid) => {
    const booked = bookedByUuid.get(uuid) ?? [];
    return !booked.some((b) => b.start < endMs && b.end > startMs);
  });
}

function extractArray<T>(raw: any): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (Array.isArray(raw?.data)) return raw.data as T[];
  if (Array.isArray(raw?.data?.data)) return raw.data.data as T[];
  return [];
}

// ----------------------------------------------------------------------------
// Identity maps — appointments key practitioners/patients by NUMERIC id, while
// the rest of the app keys them by UUID. Cache the crosswalk (short TTL) so we
// can translate both directions and attach display names cheaply.
// ----------------------------------------------------------------------------
type IdMaps = {
  byNumeric: Map<string, { uuid: string; name: string }>;
  byUuid: Map<string, string>;
};
const MAP_TTL_MS = 60_000;
let pracMapCache: { at: number; maps: IdMaps } | null = null;
let patMapCache: { at: number; maps: IdMaps } | null = null;

async function getPractitionerMaps(): Promise<IdMaps> {
  if (pracMapCache && Date.now() - pracMapCache.at < MAP_TTL_MS) return pracMapCache.maps;
  const byNumeric = new Map<string, { uuid: string; name: string }>();
  const byUuid = new Map<string, string>();
  try {
    const raw = await restJson<any>('/practitioner', { query: { _count: 500 } });
    for (const dto of extractArray<OpenEMRPractitionerDto>(raw)) {
      const p = toPractitioner(dto);
      const numeric = p.openemrNumericId;
      if (numeric && p.id) {
        byNumeric.set(numeric, { uuid: p.id, name: `${p.title} ${p.firstName} ${p.lastName}`.trim() });
        byUuid.set(p.id, numeric);
      }
    }
  } catch {
    /* best-effort */
  }
  const maps = { byNumeric, byUuid };
  pracMapCache = { at: Date.now(), maps };
  return maps;
}

async function getPatientMaps(): Promise<IdMaps> {
  if (patMapCache && Date.now() - patMapCache.at < MAP_TTL_MS) return patMapCache.maps;
  const byNumeric = new Map<string, { uuid: string; name: string }>();
  const byUuid = new Map<string, string>();
  try {
    const raw = await restJson<any>('/patient', { query: { limit: 500 } });
    for (const dto of extractArray<OpenEMRPatientDto>(raw)) {
      const p = toPatient(dto);
      if (p.openemrPid && p.id) {
        byNumeric.set(p.openemrPid, { uuid: p.id, name: `${p.firstName} ${p.lastName}`.trim() });
        byUuid.set(p.id, p.openemrPid);
      }
    }
  } catch {
    /* best-effort */
  }
  const maps = { byNumeric, byUuid };
  patMapCache = { at: Date.now(), maps };
  return maps;
}

/** Translate an appointment's numeric practitioner/patient ids to uuids + names. */
function enrichAppointment(a: Appointment, pracMap: IdMaps, patMap: IdMaps): Appointment {
  const prac = /^\d+$/.test(a.practitionerId) ? pracMap.byNumeric.get(a.practitionerId) : undefined;
  if (prac) {
    a.practitionerId = prac.uuid;
    a.practitionerName = prac.name;
  }
  const pat = /^\d+$/.test(a.patientId) ? patMap.byNumeric.get(a.patientId) : undefined;
  if (pat) {
    a.patientId = pat.uuid;
    a.patientName = pat.name;
  }
  return a;
}

async function resolvePractitionerNumericId(uuidOrId: string): Promise<string> {
  if (/^\d+$/.test(uuidOrId)) return uuidOrId;
  try {
    const raw = await restJson<any>(`/practitioner/${encodeURIComponent(uuidOrId)}`);
    const dto = (raw?.data ?? raw) as OpenEMRPractitionerDto;
    if (dto?.id != null) return String(dto.id);
  } catch {
    /* fall through */
  }
  return uuidOrId;
}

async function resolvePatientNumericId(uuidOrPid: string): Promise<string> {
  if (/^\d+$/.test(uuidOrPid)) return uuidOrPid;
  try {
    const raw = await restJson<any>(`/patient/${encodeURIComponent(uuidOrPid)}`);
    const dto = (raw?.data ?? raw) as OpenEMRPatientDto;
    if (dto?.pid != null) return String(dto.pid);
  } catch {
    /* fall through */
  }
  return uuidOrPid;
}
