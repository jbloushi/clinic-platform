'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LOCALE_LABEL, LOCALE_SHORT, otherLocale, type Locale } from '@/lib/i18n';

/**
 * Language control from the approved header: a single compact tile showing the
 * language you'd switch *to*. Rendered as a link so it works without client
 * JavaScript; the route handler sets the cookie and returns to this page.
 *
 * `variant="on-brand"` is for the teal patient header, `surface` for light
 * headers.
 */
export function LanguageSwitcher({
  locale,
  variant = 'surface',
  className,
}: {
  locale: Locale;
  variant?: 'surface' | 'on-brand';
  className?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const target = otherLocale(locale);

  const query = searchParams.toString();
  const next = `${pathname}${query ? `?${query}` : ''}`;
  const href = `/api/locale?locale=${target}&next=${encodeURIComponent(next)}`;

  return (
    <Link
      href={href}
      prefetch={false}
      lang={target}
      aria-label={`Switch language to ${LOCALE_LABEL[target]}`}
      className={cn(
        'press-scale inline-flex h-[38px] min-w-[38px] items-center justify-center rounded-control px-2.5 text-[15px] font-bold leading-none transition-colors',
        variant === 'on-brand'
          ? 'bg-white/[.12] text-surface-soft hover:bg-white/20'
          : 'border bg-surface text-primary hover:bg-muted',
        className,
      )}
    >
      <span aria-hidden>{LOCALE_SHORT[target]}</span>
    </Link>
  );
}
