/**
 * The one specialty normalizer.
 *
 * OpenEMR's `users.specialty` is free text typed by whoever set the doctor up,
 * so "ENT", "ent", "E.N.T", "Ear-Nose-Throat" and "Ear Nose  Throat" all arrive
 * as distinct strings for the same thing. Every place that compares a specialty
 * — backfills, seeds, ops writes, practitioner matching, readiness checks and
 * tests — must fold them identically, or a department mapping saved through one
 * path silently fails to match through another.
 *
 * NFKC first so full-width and compatibility characters collapse before case is
 * folded; `en` locale explicitly, because Turkish locale rules would map "I" to
 * a dotless "ı" and break matching for anyone with that system locale.
 *
 * The original text is always retained alongside for display — this output is a
 * matching key, never something shown to a user.
 */
export function normalizeSpecialty(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}
