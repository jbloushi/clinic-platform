import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from './i18n';

/**
 * Server-only half of the locale plumbing.
 *
 * Kept separate from `./i18n` because `next/headers` can't be pulled into a
 * client component's module graph — the language switcher imports the labels and
 * helpers from there, and would fail to compile if this lived alongside them.
 */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
