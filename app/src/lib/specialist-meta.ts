/**
 * Display helpers for specialist identity and availability.
 *
 * Everything here is derived from authoritative provider data. Ratings, spoken
 * languages, procedure counts and visit modes appear in the visual design but
 * have no source in OpenEMR's user record, so they are deliberately absent —
 * synthesising credibility signals for a medical directory isn't acceptable,
 * even as placeholder content. Add them back only alongside a real data source.
 */

/** Next-available slot: raw ISO (drives tone logic) + a formatted label. */
export type NextAvailable = { iso: string; label: string };

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
