/**
 * Deterministic color coding for medical specialties.
 *
 * Calm, clinical hues (no childish neon). Each specialty maps to a coherent set:
 * an avatar gradient, a badge/pill, a status dot and an icon tint. Known
 * specialties get a hand-picked hue; anything else is hashed into the palette.
 *
 * All class strings are written literally so Tailwind's JIT keeps them.
 */
export type SpecialtyColor = {
  avatar: string; // gradient for InitialsAvatar
  pill: string; // badge background/text/border
  dot: string; // status dot
  icon: string; // icon tint
  soft: string; // soft surface tint (e.g. icon chip bg)
};

const PALETTE: SpecialtyColor[] = [
  { avatar: 'from-blue-500 to-blue-700', pill: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500', icon: 'text-blue-600', soft: 'bg-blue-50 text-blue-600' },
  { avatar: 'from-rose-500 to-rose-700', pill: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500', icon: 'text-rose-600', soft: 'bg-rose-50 text-rose-600' },
  { avatar: 'from-amber-500 to-orange-600', pill: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', icon: 'text-amber-600', soft: 'bg-amber-50 text-amber-600' },
  { avatar: 'from-emerald-500 to-teal-600', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', icon: 'text-emerald-600', soft: 'bg-emerald-50 text-emerald-600' },
  { avatar: 'from-violet-500 to-indigo-600', pill: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500', icon: 'text-violet-600', soft: 'bg-violet-50 text-violet-600' },
  { avatar: 'from-teal-500 to-cyan-600', pill: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500', icon: 'text-teal-600', soft: 'bg-teal-50 text-teal-600' },
  { avatar: 'from-fuchsia-500 to-pink-600', pill: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200', dot: 'bg-fuchsia-500', icon: 'text-fuchsia-600', soft: 'bg-fuchsia-50 text-fuchsia-600' },
  { avatar: 'from-sky-500 to-blue-600', pill: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500', icon: 'text-sky-600', soft: 'bg-sky-50 text-sky-600' },
];

const EXPLICIT: Record<string, number> = {
  'internal medicine': 0,
  cardiology: 1,
  pediatrics: 2,
  'family medicine': 3,
  orthopedics: 4,
  ent: 5,
  'general practice': 0,
  dermatology: 6,
  neurology: 7,
};

export function specialtyColor(specialty: string): SpecialtyColor {
  const key = (specialty ?? '').trim().toLowerCase();
  if (key in EXPLICIT) return PALETTE[EXPLICIT[key]];
  let n = 0;
  for (let i = 0; i < key.length; i++) n = (n * 31 + key.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(n) % PALETTE.length];
}
