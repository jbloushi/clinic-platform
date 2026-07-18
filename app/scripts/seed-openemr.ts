/**
 * Comprehensive demo seed for the clinic platform.
 *
 * Populates BOTH:
 *  - OpenEMR (MariaDB, direct insert): doctors, patients, appointments,
 *    clinical records (problems / allergies / medications / vitals) and
 *    encounters — with uuid_registry entries so the app's FHIR reads work.
 *  - Platform DB (Prisma): patient identities (mobile login), per-doctor
 *    availability, wallet ledger, bookings and payments.
 *
 * This is a CLEAR-AND-RESEED script: it wipes prior demo data (all patients,
 * non-system users, appointments, records) and rebuilds a deterministic set.
 * Safe for the demo instance only — never point OPENEMR_DB_URL at real data.
 *
 * Run:  npm run seed
 */
import { createConnection, type Connection } from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

// Facility + calendar-category IDs default to a stock OpenEMR install's values
// (facility 3 = "Your Clinic Name", category 5 = "Office Visit"). A different
// target instance (e.g. the VPS) may assign different IDs — verify on that
// OpenEMR first and override via env. See the deployment runbook (Phase D).
const FACILITY_ID = Number(process.env.SEED_FACILITY_ID ?? 3);
const CAT_OFFICE_VISIT = Number(process.env.SEED_OFFICE_VISIT_CATID ?? 5);

// ----------------------------------------------------------------------------
// Deterministic PRNG so re-runs produce the same clinic.
// ----------------------------------------------------------------------------
let _seed = 1337;
function rnd(): number {
  _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
  return _seed / 0x7fffffff;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}
function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0]);
  return out;
}
function chance(p: number): boolean {
  return rnd() < p;
}

// ----------------------------------------------------------------------------
// UUID helpers (OpenEMR stores binary(16); FHIR reads need a registry entry).
// ----------------------------------------------------------------------------
function uuidHex(): string {
  return randomBytes(16).toString('hex');
}
async function registerUuid(conn: Connection, hex: string, table: string) {
  await conn.query('INSERT INTO uuid_registry (uuid, table_name, mapped, created) VALUES (UNHEX(?), ?, 1, NOW())', [
    hex,
    table,
  ]);
}

function fmtDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function fmtDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${fmtDate(d)} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
}
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(9, 0, 0, 0);
  return d;
}

// ----------------------------------------------------------------------------
// Reference data
// ----------------------------------------------------------------------------
const DOCTORS = [
  { fname: 'Amina', lname: 'Haddad', specialty: 'Internal Medicine', taxonomy: '207R00000X', bio: 'Consultant internist focusing on preventive care and chronic disease management.' },
  { fname: 'Yusuf', lname: 'Rahman', specialty: 'Cardiology', taxonomy: '207RC0000X', bio: 'Cardiologist covering hypertension, arrhythmia workup and cardiac risk assessment.' },
  { fname: 'Sara', lname: 'Khalil', specialty: 'Pediatrics', taxonomy: '208000000X', bio: 'Pediatrician covering well-child visits, immunizations and common childhood illness.' },
  { fname: 'Omar', lname: 'Farouk', specialty: 'Dermatology', taxonomy: '207N00000X', bio: 'Dermatologist treating skin, hair and nail conditions for all ages.' },
  { fname: 'Layla', lname: 'Mansour', specialty: 'Orthopedics', taxonomy: '207X00000X', bio: 'Orthopedic surgeon focused on joints, sports injuries and fracture care.' },
  { fname: 'Khalid', lname: 'Nasser', specialty: 'ENT', taxonomy: '207Y00000X', bio: 'Otolaryngologist managing ear, nose and throat conditions.' },
  { fname: 'Nadia', lname: 'Aziz', specialty: 'Family Medicine', taxonomy: '207Q00000X', bio: 'Family physician providing whole-family primary care.' },
  { fname: 'Tariq', lname: 'Saleh', specialty: 'Cardiology', taxonomy: '207RC0000X', bio: 'Interventional cardiologist with a focus on preventive heart health.' },
];

const FIRST_NAMES = ['James', 'Mary', 'Ahmed', 'Fatima', 'John', 'Aisha', 'Robert', 'Noor', 'David', 'Layla', 'Michael', 'Sara', 'William', 'Huda', 'Richard', 'Mariam', 'Joseph', 'Zainab', 'Thomas', 'Leila', 'Daniel', 'Rania', 'Matthew', 'Salma'];
const LAST_NAMES = ['Smith', 'Johnson', 'Ali', 'Hassan', 'Williams', 'Ibrahim', 'Brown', 'Kholi', 'Jones', 'Said', 'Garcia', 'Nasr', 'Miller', 'Darwish', 'Davis', 'Fadel', 'Rodriguez', 'Habib', 'Martinez', 'Sultan', 'Wilson', 'Karam', 'Anderson', 'Zaki'];
const CITIES = ['Riyadh', 'Jeddah', 'Dubai', 'Doha', 'Manama', 'Kuwait City', 'Muscat'];

const PROBLEMS = [
  { title: 'Essential hypertension', dx: 'ICD10:I10' },
  { title: 'Type 2 diabetes mellitus', dx: 'ICD10:E11.9' },
  { title: 'Hyperlipidemia', dx: 'ICD10:E78.5' },
  { title: 'Asthma', dx: 'ICD10:J45.909' },
  { title: 'Gastroesophageal reflux disease', dx: 'ICD10:K21.9' },
  { title: 'Migraine', dx: 'ICD10:G43.909' },
  { title: 'Hypothyroidism', dx: 'ICD10:E03.9' },
  { title: 'Osteoarthritis of knee', dx: 'ICD10:M17.9' },
  { title: 'Generalized anxiety disorder', dx: 'ICD10:F41.1' },
  { title: 'Allergic rhinitis', dx: 'ICD10:J30.9' },
  { title: 'Vitamin D deficiency', dx: 'ICD10:E55.9' },
  { title: 'Iron deficiency anemia', dx: 'ICD10:D50.9' },
];
// OpenEMR's FHIR AllergyIntolerance only emits the substance when the row carries
// a code (like problems need an ICD10 code). The RxNorm code makes it valid; the
// displayed name comes from `title`, so exact code choice only needs to be non-empty.
const ALLERGIES = [
  { title: 'Penicillin', reaction: 'Hives', code: 'RXNORM:7984' },
  { title: 'Sulfa drugs', reaction: 'Rash', code: 'RXNORM:10831' },
  { title: 'Peanuts', reaction: 'Anaphylaxis', code: 'RXNORM:91155' },
  { title: 'Latex', reaction: 'Contact dermatitis', code: 'RXNORM:28889' },
  { title: 'Aspirin', reaction: 'Bronchospasm', code: 'RXNORM:1191' },
  { title: 'Shellfish', reaction: 'Swelling', code: 'RXNORM:91155' },
];
const MEDS = [
  'Lisinopril 10 mg — 1 tab daily',
  'Metformin 500 mg — 1 tab twice daily',
  'Atorvastatin 20 mg — 1 tab at night',
  'Albuterol inhaler — 2 puffs as needed',
  'Levothyroxine 50 mcg — 1 tab each morning',
  'Omeprazole 20 mg — 1 tab before breakfast',
  'Amlodipine 5 mg — 1 tab daily',
  'Sertraline 50 mg — 1 tab daily',
  'Cetirizine 10 mg — 1 tab daily',
];
const VISIT_REASONS = ['Routine check-up', 'Follow-up visit', 'New consultation', 'Blood pressure review', 'Medication refill', 'Chest pain evaluation', 'Persistent cough', 'Skin rash', 'Joint pain', 'Headache', 'Annual physical', 'Lab results review'];

// ----------------------------------------------------------------------------
// Reset
// ----------------------------------------------------------------------------
async function reset(conn: Connection) {
  console.log('· clearing prior demo data…');
  // OpenEMR — keep the 4 system users (id 1-4)
  const emrTables = ['openemr_postcalendar_events', 'lists', 'lists_medication', 'form_vitals', 'forms', 'form_encounter'];
  for (const t of emrTables) await conn.query(`DELETE FROM \`${t}\``);
  await conn.query('DELETE FROM patient_data');
  await conn.query('DELETE FROM users WHERE id > 4');
  await conn.query(
    "DELETE FROM uuid_registry WHERE table_name IN ('lists','form_vitals','form_encounter','patient_data','users','openemr_postcalendar_events')",
  );
  await conn.query('ALTER TABLE patient_data AUTO_INCREMENT = 1');
  await conn.query('ALTER TABLE users AUTO_INCREMENT = 5');
  await conn.query('ALTER TABLE openemr_postcalendar_events AUTO_INCREMENT = 1');
  await conn.query('ALTER TABLE form_encounter AUTO_INCREMENT = 1');
  await conn.query('ALTER TABLE form_vitals AUTO_INCREMENT = 1');
  await conn.query('ALTER TABLE lists AUTO_INCREMENT = 1');
  await conn.query('ALTER TABLE forms AUTO_INCREMENT = 1');

  // Platform DB — keep staffUser + service
  await prisma.payment.deleteMany();
  await prisma.bookingHold.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.patientIdentity.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.sessionLog.deleteMany();
  // serviceSpecialist rows reference doctor UUIDs we're about to regenerate.
  await prisma.serviceSpecialist.deleteMany();
}

// ----------------------------------------------------------------------------
// Seed
// ----------------------------------------------------------------------------
type DoctorRow = { id: number; uuid: string; fname: string; lname: string; specialty: string };
type PatientRow = { pid: number; uuid: string; fname: string; lname: string; mobile: string; hasIdentity: boolean };

async function seedDoctors(conn: Connection): Promise<DoctorRow[]> {
  console.log('· doctors…');
  const rows: DoctorRow[] = [];
  for (let i = 0; i < DOCTORS.length; i++) {
    const d = DOCTORS[i];
    const hex = uuidHex();
    const username = `doc_${d.fname.toLowerCase()}_${d.lname.toLowerCase()}`;
    const npi = String(9_000_000_000 + Math.floor(rnd() * 999_999_999)).slice(0, 10);
    const [res] = (await conn.query(
      `INSERT INTO users (uuid, username, fname, lname, authorized, active, federaltaxid, federaldrugid, upin,
        facility, facility_id, npi, title, specialty, taxonomy, calendar, cal_ui, see_auth,
        physician_type, main_menu_role, patient_menu_role, date_created, info)
       VALUES (UNHEX(?), ?, ?, ?, 1, 1, '', '', '', 'Your Clinic Name Here', ?, ?, 'Dr.', ?, ?, 1, 3, 1,
        'doctor', 'standard', 'standard', NOW(), ?)`,
      [hex, username, d.fname, d.lname, FACILITY_ID, npi, d.specialty, d.taxonomy, d.bio],
    )) as any;
    await registerUuid(conn, hex, 'users');
    const id = res.insertId as number;
    const uuid = formatUuid(hex);
    rows.push({ id, uuid, fname: d.fname, lname: d.lname, specialty: d.specialty });

    // Availability rules in platform DB (varied schedules)
    const morning = { startTime: '09:00', endTime: '13:00', slotMinutes: 20 };
    const afternoon = { startTime: '14:00', endTime: '18:00', slotMinutes: 20 };
    const patterns: any[][] = [
      [1, 2, 3, 4, 0].map((dow) => ({ dayOfWeek: dow, ...morning })),
      [1, 3, 5].map((dow) => ({ dayOfWeek: dow, ...afternoon })),
      [0, 1, 2, 3, 4].map((dow) => ({ dayOfWeek: dow, ...(dow % 2 ? afternoon : morning) })),
      [2, 3, 4].map((dow) => ({ dayOfWeek: dow, ...morning })),
    ];
    const rules = patterns[i % patterns.length];
    await prisma.auditLog.create({
      data: { actor: 'system:seed', action: 'practitioner.availability.set', target: uuid, metadata: JSON.stringify(rules) },
    });
  }

  // Link the demo doctor staff account to the first cardiologist
  const cardio = rows.find((r) => r.specialty === 'Cardiology');
  if (cardio) {
    await prisma.staffUser.updateMany({ where: { email: 'doctor@clinic.local' }, data: { openemrUserId: cardio.uuid } });
  }
  return rows;
}

async function seedPatients(conn: Connection): Promise<PatientRow[]> {
  console.log('· patients…');
  const rows: PatientRow[] = [];
  const N = 24;
  for (let i = 0; i < N; i++) {
    const fname = FIRST_NAMES[i % FIRST_NAMES.length];
    const lname = LAST_NAMES[(i * 7) % LAST_NAMES.length];
    const sex = chance(0.5) ? 'Male' : 'Female';
    const age = 6 + Math.floor(rnd() * 74);
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - age, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 27));
    const mobile = `+9665${String(10_000_000 + Math.floor(rnd() * 89_999_999))}`;
    const email = `${fname.toLowerCase()}.${lname.toLowerCase()}${i}@example.com`;
    const city = pick(CITIES);
    const hex = uuidHex();
    // OpenEMR's patient_data.pid is NOT auto-increment — the app assigns it.
    // We cleared the table in reset(), so assign sequential pids starting at 1.
    const pid = i + 1;
    await conn.query(
      `INSERT INTO patient_data (pid, uuid, pubpid, fname, lname, DOB, sex, phone_cell, email, street, city, state, country_code, date, regdate)
       VALUES (?, UNHEX(?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SA', NOW(), CURDATE())`,
      [pid, hex, String(pid), fname, lname, fmtDate(dob), sex, mobile, email, `${100 + i} Clinic St`, city, city],
    );
    await registerUuid(conn, hex, 'patient_data');
    const uuid = formatUuid(hex);

    // ~55% of patients are "returning" — give them a mobile-login identity
    const hasIdentity = chance(0.55);
    if (hasIdentity) {
      await prisma.patientIdentity.create({
        data: { mobile, firstName: fname, lastName: lname, email, openemrPatientUuid: uuid, lastLoginAt: new Date() },
      });
    }
    rows.push({ pid, uuid, fname, lname, mobile, hasIdentity });
  }
  return rows;
}

async function seedClinical(conn: Connection, patients: PatientRow[], doctors: DoctorRow[]) {
  console.log('· clinical records + encounters…');
  let encounterNo = 1000;
  // ~65% of patients get a clinical history
  for (const p of patients) {
    if (!chance(0.65)) continue;
    const provider = pick(doctors);

    // Problems
    for (const prob of pickN(PROBLEMS, 1 + Math.floor(rnd() * 3))) {
      const hex = uuidHex();
      const onset = new Date();
      onset.setMonth(onset.getMonth() - Math.floor(rnd() * 48));
      await conn.query(
        `INSERT INTO lists (uuid, date, type, title, begdate, diagnosis, activity, pid, \`user\`, groupname, comments)
         VALUES (UNHEX(?), NOW(), 'medical_problem', ?, ?, ?, 1, ?, 'clinic-admin', 'Default', '')`,
        [hex, prob.title, fmtDate(onset), prob.dx, p.pid],
      );
      await registerUuid(conn, hex, 'lists');
    }
    // Allergies (with RxNorm code so FHIR emits the substance name)
    for (const al of pickN(ALLERGIES, 1 + Math.floor(rnd() * 2))) {
      const hex = uuidHex();
      await conn.query(
        `INSERT INTO lists (uuid, date, type, title, begdate, diagnosis, activity, pid, \`user\`, groupname, reaction)
         VALUES (UNHEX(?), NOW(), 'allergy', ?, CURDATE(), ?, 1, ?, 'clinic-admin', 'Default', ?)`,
        [hex, al.title, al.code, p.pid, al.reaction],
      );
      await registerUuid(conn, hex, 'lists');
    }
    // Medications
    for (const med of pickN(MEDS, Math.floor(rnd() * 3))) {
      const hex = uuidHex();
      await conn.query(
        `INSERT INTO lists (uuid, date, type, title, begdate, activity, pid, \`user\`, groupname)
         VALUES (UNHEX(?), NOW(), 'medication', ?, CURDATE(), 1, ?, 'clinic-admin', 'Default')`,
        [hex, med, p.pid],
      );
      await registerUuid(conn, hex, 'lists');
    }

    // 1–3 past encounters, each with vitals
    const nEnc = 1 + Math.floor(rnd() * 3);
    for (let e = 0; e < nEnc; e++) {
      encounterNo += 1;
      const when = new Date();
      when.setDate(when.getDate() - (7 + Math.floor(rnd() * 200)));
      when.setHours(9 + Math.floor(rnd() * 8), 0, 0, 0);
      const reason = pick(VISIT_REASONS);

      const encHex = uuidHex();
      await conn.query(
        `INSERT INTO form_encounter (uuid, date, reason, facility, facility_id, pid, encounter, provider_id, pc_catid)
         VALUES (UNHEX(?), ?, ?, 'Your Clinic Name Here', ?, ?, ?, ?, ?)`,
        [encHex, fmtDateTime(when), reason, FACILITY_ID, p.pid, encounterNo, provider.id, CAT_OFFICE_VISIT],
      );
      await registerUuid(conn, encHex, 'form_encounter');

      // Vitals form
      const vHex = uuidHex();
      const bps = 108 + Math.floor(rnd() * 40);
      const bpd = 68 + Math.floor(rnd() * 22);
      const weight = 55 + Math.floor(rnd() * 45); // kg
      const height = 150 + Math.floor(rnd() * 40); // cm
      const pulse = 60 + Math.floor(rnd() * 35);
      const temp = (36.4 + rnd() * 1.2).toFixed(1);
      const resp = 12 + Math.floor(rnd() * 8);
      const [vRes] = (await conn.query(
        `INSERT INTO form_vitals (uuid, date, pid, \`user\`, groupname, authorized, activity, bps, bpd, weight, height, temperature, pulse, respiration)
         VALUES (UNHEX(?), ?, ?, 'clinic-admin', 'Default', 1, 1, ?, ?, ?, ?, ?, ?, ?)`,
        [vHex, fmtDateTime(when), p.pid, bps, bpd, weight, height, temp, pulse, resp],
      )) as any;
      await registerUuid(conn, vHex, 'form_vitals');
      const vitalsId = vRes.insertId as number;

      // Link vitals form into the encounter
      await conn.query(
        `INSERT INTO forms (date, encounter, form_name, form_id, pid, \`user\`, groupname, authorized, deleted, formdir, provider_id)
         VALUES (?, ?, 'Vitals', ?, ?, 'clinic-admin', 'Default', 1, 0, 'vitals', ?)`,
        [fmtDateTime(when), encounterNo, vitalsId, p.pid, provider.id],
      );
    }
  }
}

type ApptPlan = { pid: number; aid: number; when: Date; durMin: number; status: string; reason: string };

async function seedAppointments(conn: Connection, patients: PatientRow[], doctors: DoctorRow[]) {
  console.log('· appointments…');
  const plans: ApptPlan[] = [];

  const statusPast = ['$', '$', '$', '?', 'x']; // completed, completed, completed, no-show, cancelled
  const statusToday = ['@', '$', '-', '@', '-']; // arrived, completed, confirmed…
  const statusFuture = ['-', '-', '*']; // confirmed / pending

  // Past 12 days
  for (let day = -12; day < 0; day++) {
    const count = 2 + Math.floor(rnd() * 4);
    for (let i = 0; i < count; i++) {
      const d = daysFromNow(day);
      d.setHours(9 + Math.floor(rnd() * 8), pick([0, 20, 40]), 0, 0);
      plans.push({
        pid: pick(patients).pid,
        aid: pick(doctors).id,
        when: d,
        durMin: pick([20, 20, 30]),
        status: pick(statusPast),
        reason: pick(VISIT_REASONS),
      });
    }
  }
  // Today
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setHours(9 + i, pick([0, 30]), 0, 0);
    plans.push({
      pid: pick(patients).pid,
      aid: pick(doctors).id,
      when: d,
      durMin: pick([20, 30]),
      status: pick(statusToday),
      reason: pick(VISIT_REASONS),
    });
  }
  // Next 14 days
  for (let day = 1; day <= 14; day++) {
    const count = 1 + Math.floor(rnd() * 4);
    for (let i = 0; i < count; i++) {
      const d = daysFromNow(day);
      d.setHours(9 + Math.floor(rnd() * 8), pick([0, 20, 40]), 0, 0);
      plans.push({
        pid: pick(patients).pid,
        aid: pick(doctors).id,
        when: d,
        durMin: pick([20, 20, 30]),
        status: pick(statusFuture),
        reason: pick(VISIT_REASONS),
      });
    }
  }

  for (const a of plans) {
    const end = new Date(a.when.getTime() + a.durMin * 60_000);
    const p2 = (n: number) => String(n).padStart(2, '0');
    const startTime = `${p2(a.when.getHours())}:${p2(a.when.getMinutes())}`;
    const endTime = `${p2(end.getHours())}:${p2(end.getMinutes())}`;
    await conn.query(
      `INSERT INTO openemr_postcalendar_events
        (pc_catid, pc_multiple, pc_aid, pc_pid, pc_title, pc_time, pc_hometext, pc_eventDate, pc_endDate,
         pc_duration, pc_startTime, pc_endTime, pc_facility, pc_billing_location, pc_apptstatus, pc_eventstatus, pc_sharing)
       VALUES (?, 0, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
      [
        CAT_OFFICE_VISIT,
        String(a.aid),
        String(a.pid),
        a.reason,
        a.reason,
        fmtDate(a.when),
        fmtDate(a.when),
        a.durMin * 60,
        startTime,
        endTime,
        FACILITY_ID,
        FACILITY_ID,
        a.status,
      ],
    );
  }
  return plans;
}

/**
 * Assign realistic specialist eligibility per service (Phase 2 of the
 * specialists program). Uses real freshly-seeded doctor UUIDs, so this must
 * run after seedDoctors() and can only live here — not in prisma/seed.ts,
 * which runs first and has no OpenEMR UUIDs to reference yet.
 *
 * 'New consultation' / 'Follow-up visit' are intentionally left with zero
 * rows (= any active specialist), demonstrating the fallback path.
 */
async function seedServiceSpecialists(doctors: DoctorRow[]) {
  console.log('· service <-> specialist eligibility…');
  const services = await prisma.service.findMany();
  if (services.length === 0) return;

  const bySpecialty = (specialty: string) => doctors.filter((d) => d.specialty === specialty).map((d) => d.uuid);

  const rules: Record<string, string[]> = {
    'Extended consultation': bySpecialty('Internal Medicine'),
    'Procedure (in-clinic)': bySpecialty('Dermatology'),
  };

  for (const svc of services) {
    const uuids = rules[svc.name];
    if (!uuids || uuids.length === 0) continue;
    await prisma.serviceSpecialist.createMany({
      data: uuids.map((specialistOpenemrUuid) => ({ serviceId: svc.id, specialistOpenemrUuid })),
    });
  }
}

async function seedPlatform(patients: PatientRow[], doctors: DoctorRow[]) {
  console.log('· platform wallet / bookings / payments…');
  const services = await prisma.service.findMany({ where: { active: true } });
  if (services.length === 0) return;

  const identities = await prisma.patientIdentity.findMany();
  for (const idn of identities) {
    // Give returning patients some wallet activity
    if (chance(0.5)) {
      await prisma.walletTransaction.create({
        data: {
          patientId: idn.id,
          amountMinor: pick([5000, 7500, 10000]),
          currency: 'KWD',
          source: 'consultation_credit',
          reference: 'Post-visit credit',
          createdBy: 'system:seed',
        },
      });
      if (chance(0.4)) {
        await prisma.walletTransaction.create({
          data: {
            patientId: idn.id,
            amountMinor: -pick([2000, 3000, 5000]),
            currency: 'KWD',
            source: 'payment',
            reference: 'Applied at checkout',
            createdBy: 'system:seed',
          },
        });
      }
    }

    // An upcoming booking for some returning patients (so "My appointments" is populated)
    if (chance(0.6)) {
      const svc = pick(services);
      const doc = pick(doctors);
      const when = daysFromNow(1 + Math.floor(rnd() * 12));
      when.setHours(9 + Math.floor(rnd() * 7), pick([0, 20, 40]), 0, 0);
      const end = new Date(when.getTime() + svc.durationMinutes * 60_000);
      const booking = await prisma.bookingHold.create({
        data: {
          patientIdentityId: idn.id,
          practitionerOpenemrId: doc.uuid,
          serviceId: svc.id,
          startAt: when,
          endAt: end,
          status: 'confirmed',
          reason: pick(VISIT_REASONS),
          holdExpiresAt: when,
        },
      });
      await prisma.payment.create({
        data: {
          bookingHoldId: booking.id,
          patientId: idn.id,
          amountMinor: svc.priceMinor,
          currency: svc.currency,
          method: 'card_mock',
          status: 'succeeded',
        },
      });
    }
  }
}

function formatUuid(hex: string): string {
  const s = hex.toLowerCase();
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

async function main() {
  const url = process.env.OPENEMR_DB_URL;
  if (!url) throw new Error('OPENEMR_DB_URL is not set (add it to app/.env).');
  const conn = await createConnection(url);
  // OpenEMR's legacy schema uses zero-dates ('0000-00-00') as column defaults,
  // which strict SQL mode rejects during ALTER/INSERT. Relax the mode for the seed.
  await conn.query("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");
  console.log('Seeding demo clinic…');
  await reset(conn);
  const doctors = await seedDoctors(conn);
  const patients = await seedPatients(conn);
  await seedClinical(conn, patients, doctors);
  const appts = await seedAppointments(conn, patients, doctors);
  await seedServiceSpecialists(doctors);
  await seedPlatform(patients, doctors);
  await conn.end();

  console.log('\nDone. Summary:');
  console.log(`  doctors:      ${doctors.length}`);
  console.log(`  patients:     ${patients.length} (${patients.filter((p) => p.hasIdentity).length} with mobile login)`);
  console.log(`  appointments: ${appts.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
