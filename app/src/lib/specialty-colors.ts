/**
 * Deterministic color coding for medical specialties.
 *
 * These are the approved redesign's avatar/chip families: a deep-teal house
 * gradient for the clinic's core specialty, plus warm regional companions
 * (bronze, indigo, plum, olive, rose) that sit beside the sand surfaces without
 * fighting the teal-and-gold brand. Known specialties get a hand-picked family;
 * anything else is hashed in, so the same specialist keeps the same color on
 * every screen.
 *
 * Gradient stops are written as literal hexes because they are decorative brand
 * artwork rather than semantic UI color — everything semantic (text, borders,
 * surfaces) goes through the token classes below. All class strings are literal
 * so Tailwind's JIT keeps them.
 */
export type SpecialtyColor = {
  avatar: string; // gradient for InitialsAvatar
  pill: string; // badge background/text/border
  dot: string; // status dot
  icon: string; // icon tint
  soft: string; // soft surface tint (e.g. icon chip bg)
};

const PALETTE: SpecialtyColor[] = [
  // House teal — the clinic's own gradient (primary → primary-dark).
  {
    avatar: 'from-[#0B5C55] to-[#08423D]',
    pill: 'bg-tint-teal text-primary border-tint-teal-border',
    dot: 'bg-primary',
    icon: 'text-primary',
    soft: 'bg-tint-teal text-primary',
  },
  // Bronze — warm, regional, pairs with the gold accent.
  {
    avatar: 'from-[#8A5A2B] to-[#5E3A17]',
    pill: 'bg-tint-gold text-accent-foreground border-tint-gold-border',
    dot: 'bg-[#8A5A2B]',
    icon: 'text-[#8A5A2B]',
    soft: 'bg-tint-gold text-accent-foreground',
  },
  // Olive — nutrition and lifestyle care.
  {
    avatar: 'from-[#5B8C3E] to-[#3E6329]',
    pill: 'bg-[#EAF1E4] text-[#3E6329] border-[#D5E3CB]',
    dot: 'bg-[#5B8C3E]',
    icon: 'text-[#4C7634]',
    soft: 'bg-[#EAF1E4] text-[#4C7634]',
  },
  // Indigo — procedural and surgical specialties.
  {
    avatar: 'from-[#2F6DB0] to-[#274F86]',
    pill: 'bg-[#E4EDF6] text-[#274F86] border-[#CBDCEC]',
    dot: 'bg-[#2F6DB0]',
    icon: 'text-[#2F6DB0]',
    soft: 'bg-[#E4EDF6] text-[#2F6DB0]',
  },
  // Plum — diagnostics and endoscopy.
  {
    avatar: 'from-[#7A5EA6] to-[#523F73]',
    pill: 'bg-[#EDE7F4] text-[#523F73] border-[#DCD2E9]',
    dot: 'bg-[#7A5EA6]',
    icon: 'text-[#7A5EA6]',
    soft: 'bg-[#EDE7F4] text-[#7A5EA6]',
  },
  // Rose — women's health and reconstructive care.
  {
    avatar: 'from-[#B04F7A] to-[#7E3455]',
    pill: 'bg-[#F6E7ED] text-[#7E3455] border-[#EBD3DE]',
    dot: 'bg-[#B04F7A]',
    icon: 'text-[#B04F7A]',
    soft: 'bg-[#F6E7ED] text-[#B04F7A]',
  },
  // Terracotta — reserved for alerting/clinical-attention accents.
  {
    avatar: 'from-[#B0603F] to-[#7F412A]',
    pill: 'bg-[#F3E7E2] text-[#7F412A] border-[#E6D2C9]',
    dot: 'bg-[#B0603F]',
    icon: 'text-[#B0603F]',
    soft: 'bg-[#F3E7E2] text-[#B0603F]',
  },
];

/**
 * Hand-picked families for the clinic's own departments and the specialty
 * strings OpenEMR is seeded with. Keys are lower-cased and matched on a
 * substring basis so "Consultant · Obesity & Oncology Surgery" still lands on
 * the house teal.
 */
const EXPLICIT: [pattern: string, index: number][] = [
  ['obesity', 0],
  ['bariatric', 0],
  ['oncology', 0],
  ['nutrition', 2],
  ['dietet', 2],
  ['dietitian', 2],
  ['gastro', 4],
  ['endoscopy', 4],
  ['liver', 4],
  ['hepat', 4],
  ['plastic', 5],
  ['reconstructive', 5],
  ['obstetric', 5],
  ['gynae', 5],
  ['gynec', 5],
  ['general surgery', 3],
  ['surgery', 3],
  ['surgical', 3],
  ['internal medicine', 0],
  ['family medicine', 2],
  ['general practice', 0],
  ['cardio', 6],
  ['dermatol', 5],
  ['orthoped', 3],
  ['pediatric', 2],
  ['neuro', 4],
  ['ent', 3],
];

export function specialtyColor(specialty: string): SpecialtyColor {
  const key = (specialty ?? '').trim().toLowerCase();
  if (key) {
    for (const [pattern, index] of EXPLICIT) {
      if (key.includes(pattern)) return PALETTE[index];
    }
  }
  let n = 0;
  for (let i = 0; i < key.length; i++) n = (n * 31 + key.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(n) % PALETTE.length];
}
