export type LocalizedText = { en: string; ar: string };

export type VisitReason = {
  slug: string;
  label: LocalizedText;
  /** Service this reason books into — matches `Service.slug`. */
  serviceSlug: string;
  /** Extra words patients actually type, for matching only. */
  aliases?: string[];
};

/**
 * Curated visit reasons, each mapped to the service that handles it.
 *
 * A hand-maintained routing table, not symptom inference: it exists so someone
 * searching "heartburn" reaches the right consultation. The UI never interprets
 * a symptom, suggests a cause, or implies a diagnosis — it only opens a booking
 * context. Anything not listed falls through to ordinary doctor/service search.
 *
 * Kept in code rather than the database because these are search synonyms, not
 * clinic reference data: they change when patient vocabulary changes, not when
 * the clinic reorganises. `serviceSlug` must match a real `Service.slug`; an
 * unmatched one simply drops out of the index rather than producing a dead link.
 */
export const visitReasons: VisitReason[] = [
  {
    slug: 'weight-loss',
    label: { en: 'Weight loss or obesity care', ar: 'إنقاص الوزن أو علاج السمنة' },
    serviceSlug: 'bariatric-consultation',
    aliases: ['weight', 'obesity', 'sleeve', 'bypass', 'bariatric', 'overweight', 'bmi'],
  },
  {
    slug: 'digestive-concern',
    label: { en: 'Digestive or liver concern', ar: 'مشكلة في الجهاز الهضمي أو الكبد' },
    serviceSlug: 'gastroenterology-consultation',
    aliases: ['heartburn', 'reflux', 'stomach', 'digestive', 'liver', 'endoscopy', 'colonoscopy'],
  },
  {
    slug: 'nutrition-plan',
    label: { en: 'Nutrition or diet plan', ar: 'خطة تغذية أو حمية' },
    serviceSlug: 'nutrition-consultation',
    aliases: ['diet', 'nutrition', 'dietitian', 'meal plan', 'eating'],
  },
  {
    slug: 'surgical-opinion',
    label: { en: 'Surgical opinion or follow-up', ar: 'رأي جراحي أو متابعة' },
    serviceSlug: 'surgical-consultation',
    aliases: ['surgery', 'hernia', 'gallbladder', 'operation', 'second opinion'],
  },
];

export function visitReasonBySlug(slug: string) {
  return visitReasons.find((item) => item.slug === slug);
}
