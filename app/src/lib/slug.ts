/**
 * URL-safe identifier from a human name.
 *
 * Used for services, departments and branches, all of which are addressable by
 * slug on the public site. `&` becomes "and" rather than being dropped, so
 * "Obesity & bariatric surgery" reads as `obesity-and-bariatric-surgery` instead
 * of the ambiguous `obesity-bariatric-surgery`.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * A slug not already present in `taken`, suffixed `-2`, `-3`… on collision.
 *
 * Callers must still handle a unique-constraint violation: two concurrent
 * creates can both read the same set and pick the same suffix.
 */
export function uniqueSlug(value: string, taken: Iterable<string>, fallback = 'item'): string {
  const base = slugify(value) || fallback;
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}
