/**
 * Demo-only derived doctor attributes.
 *
 * The card design shows a rating, spoken languages and a visit mode, none of
 * which exist in OpenEMR's user record. Rather than invent random values on
 * each render, we derive them deterministically from the practitioner id so
 * they stay stable across pages and reloads. Swap these for real fields when a
 * ratings / provider-profile source exists.
 */

function hash(seed: string, mult: number): number {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * mult + seed.charCodeAt(i)) | 0;
  return Math.abs(n);
}

/** Stable 4.5–4.9 rating. */
export function doctorRating(id: string): string {
  return (4.5 + (hash(id, 31) % 5) / 10).toFixed(1);
}

const SECOND_LANGUAGES = ['Arabic', 'Urdu', 'French', 'Hindi', 'Spanish', 'Turkish'];

/** "English · <second language>". */
export function doctorLanguages(id: string): string {
  return `English · ${SECOND_LANGUAGES[hash(id, 17) % SECOND_LANGUAGES.length]}`;
}

/** Whether the doctor offers video visits (else in-person only). */
export function doctorVisitMode(id: string): 'Video visit' | 'In-person' {
  return hash(id, 13) % 3 === 0 ? 'In-person' : 'Video visit';
}

/**
 * Availability signal for the avatar status dot, from the (real) next-available
 * hint: green when there's a slot today, amber when later, slate when none.
 */
export function availabilityTone(nextAvailable?: string): 'today' | 'soon' | 'none' {
  if (!nextAvailable) return 'none';
  return /today/i.test(nextAvailable) ? 'today' : 'soon';
}
