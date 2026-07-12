/**
 * Demo-only derived specialist attributes.
 *
 * The card design shows a rating, spoken languages and a visit mode, none of
 * which exist in OpenEMR's user record. Rather than invent random values on
 * each render, we derive them deterministically from the practitioner id so
 * they stay stable across pages and reloads. Swap these for real fields when a
 * ratings / provider-profile source exists.
 */

/** Next-available slot as passed to SpecialistCard: raw ISO (drives tone logic) + a formatted label. */
export type NextAvailable = { iso: string; label: string };

function hash(seed: string, mult: number): number {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * mult + seed.charCodeAt(i)) | 0;
  return Math.abs(n);
}

/** Stable 4.5–4.9 rating. */
export function specialistRating(id: string): string {
  return (4.5 + (hash(id, 31) % 5) / 10).toFixed(1);
}

const SECOND_LANGUAGES = ['Arabic', 'Urdu', 'French', 'Hindi', 'Spanish', 'Turkish'];

/** "English · <second language>". */
export function specialistLanguages(id: string): string {
  return `English · ${SECOND_LANGUAGES[hash(id, 17) % SECOND_LANGUAGES.length]}`;
}

/** Whether the specialist offers video visits (else in-person only). */
export function specialistVisitMode(id: string): 'Video visit' | 'In-person' {
  return hash(id, 13) % 3 === 0 ? 'In-person' : 'Video visit';
}

/**
 * Normalize OpenEMR's free-form `physician_type` value into a user-facing role
 * label. The seed uses "doctor"; production data may have "nurse", "technician",
 * "other_licensed", etc. Returns null when there's no signal (don't render).
 */
export function formatSpecialistRole(physicianType?: string | null): string | null {
  if (!physicianType) return null;
  const t = physicianType.trim().toLowerCase();
  if (!t) return null;
  if (t === 'doctor' || t === 'physician' || t === 'md') return 'Doctor';
  if (t === 'nurse' || t.startsWith('rn') || t === 'lpn') return 'Nurse';
  if (t.includes('tech')) return 'Technician';
  return 'Other';
}

/**
 * Availability signal for the avatar status dot, computed from the real next-
 * available slot's ISO start (not the formatted label — labels are display
 * text and shouldn't drive logic): green when the slot is today, amber when
 * later, slate when there's no upcoming slot.
 */
export function availabilityTone(nextAvailable?: NextAvailable): 'today' | 'soon' | 'none' {
  if (!nextAvailable) return 'none';
  return new Date(nextAvailable.iso).toDateString() === new Date().toDateString() ? 'today' : 'soon';
}

/** Human label for a slot's ISO start: "Today at 9:00 AM" / "Tomorrow at …" / "Mon, Jul 14 · …". */
export function formatNextAvailable(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const isSame = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isSame(d, today)) return `Today at ${time}`;
  if (isSame(d, tomorrow)) return `Tomorrow at ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`;
}
