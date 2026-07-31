/**
 * Locale plumbing for the bilingual clinic UI.
 *
 * This module owns *which* language is active and *which direction* it reads —
 * not the copy itself. Message catalogues are a separate piece of work; until
 * they land, screens still render English strings while the layout, navigation
 * and chevrons already mirror correctly under `dir="rtl"`. That split is
 * deliberate: it lets the RTL layout be exercised before translation lands.
 *
 * Everything here is client-safe. Reading the active locale from the request
 * needs `next/headers`, so it lives in `./i18n-server` — keeping that out of
 * this module is what lets client components import these labels and helpers.
 */
export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'clinic_locale';

export const LOCALE_LABEL: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
};

/** Short label for the compact header toggle. */
export const LOCALE_SHORT: Record<Locale, string> = {
  en: 'EN',
  ar: 'ع',
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function directionFor(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/** The other locale — what the switcher offers. */
export function otherLocale(locale: Locale): Locale {
  return locale === 'ar' ? 'en' : 'ar';
}
