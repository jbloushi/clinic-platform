'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export const PUBLIC_NAV = [
  { href: '/departments', label: 'Departments' },
  { href: '/services', label: 'Services' },
  { href: '/doctors', label: 'Doctors' },
  { href: '/branches', label: 'Branches' },
] as const;

/**
 * Section match, so `/doctors/mock-practitioner-1` still marks "Doctors".
 * Mirrors `isActive` in `PatientMobileNav` — the two navigations must agree on
 * where you are, or "persistent" is only true of the pixels.
 */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

/** Desktop header links. */
export function PublicNavLinks() {
  const pathname = usePathname();

  return (
    <>
      {PUBLIC_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-9 items-center rounded-control px-3 text-sm transition-colors',
              active
                ? 'bg-tint-teal font-semibold text-primary'
                : 'font-medium text-foreground/75 hover:bg-muted hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

/** The same destinations inside the mobile hamburger sheet. */
export function PublicNavMenuLinks() {
  const pathname = usePathname();

  return (
    <>
      {PUBLIC_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'block min-h-11 rounded-control px-3 py-3 text-sm',
              active ? 'bg-tint-teal font-semibold text-primary' : 'font-medium hover:bg-muted',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
