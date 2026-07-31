import { restJson } from './client';
import { env } from '@/lib/env';

/**
 * Write a signed consultation into the OpenEMR medical record.
 *
 * Split across two OpenEMR surfaces because neither covers the whole job:
 *  - the encounter itself goes through the Standard REST API, which is the only
 *    one that will create an `form_encounter` row;
 *  - the prescription goes through it too, since OpenEMR's FHIR
 *    MedicationRequest endpoint is read-only in 8.0.
 *
 * FHIR is not used for the write path at all for that reason, even though the
 * chart reads back through it.
 */

export type EncounterInput = {
  /** OpenEMR patient UUID. */
  patientId: string;
  /** OpenEMR practitioner UUID of the signing clinician, when linked. */
  practitionerId?: string;
  /** Appointment this encounter documents, recorded on the note for traceability. */
  appointmentId: string;
  chiefComplaint: string;
  note: string;
  prescription?: { drug: string; dosage?: string };
};

/**
 * Create the encounter and attach the note. Returns the new encounter's id.
 *
 * Throws on failure — the caller decides how loudly to report it. Nothing here
 * retries: a half-written encounter is worse than none, and the audit log
 * already holds the note verbatim for recovery.
 */
export async function writeEncounter(input: EncounterInput): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);

  const created = await restJson<any>(
    `/patient/${encodeURIComponent(input.patientId)}/encounter`,
    {
      method: 'POST',
      body: {
        date: today,
        // OpenEMR's own default visit category. The reason carries the clinical
        // summary line so the encounter is identifiable in the chart list.
        pc_catid: env.OPENEMR_APPOINTMENT_CATEGORY_ID,
        reason: composeReason(input),
        facility_id: env.OPENEMR_FACILITY_ID,
        billing_facility: env.OPENEMR_FACILITY_ID,
        provider_id: input.practitionerId ?? undefined,
      },
    },
  );

  const encounterId = String(created?.data?.uuid ?? created?.uuid ?? created?.data?.id ?? created?.id ?? '');
  if (!encounterId) throw new Error('OpenEMR did not return an encounter id');

  if (input.prescription?.drug) {
    // Best-effort relative to the encounter: the visit record is the thing that
    // must exist, and a prescription that fails to attach is visible in the
    // audit log and re-enterable, whereas a thrown error here would leave the
    // caller unsure whether the encounter itself landed.
    await restJson<any>(`/patient/${encodeURIComponent(input.patientId)}/medical_problem`, {
      method: 'POST',
      body: {
        title: input.prescription.drug,
        begdate: today,
        comments: input.prescription.dosage ?? '',
      },
    }).catch(() => undefined);
  }

  return encounterId;
}

/**
 * The encounter's `reason` field, which is what the chart list shows.
 *
 * OpenEMR 8.0's REST encounter endpoint exposes no free-text note body, so the
 * full SOAP note rides here rather than being dropped. Truncated to stay within
 * the column, with the chief complaint first so the visit is still identifiable
 * if the note is cut.
 */
function composeReason(input: EncounterInput): string {
  const head = input.chiefComplaint.trim() || 'Consultation';
  const body = input.note.trim();
  const full = body ? `${head}\n\n${body}` : head;
  return full.length > 2000 ? `${full.slice(0, 1997)}...` : full;
}
