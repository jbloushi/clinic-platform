'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TOP_ITEMS = [
  { href: '/account/appointments', label: 'My visits' },
  { href: '/account/records', label: 'Medical records' },
  { href: '/account/profile', label: 'Profile' },
  { href: '/book/v2', label: 'Book' },
];

/**
 * Desktop account navigation. On mobile these destinations are reached through
 * `PatientMobileNav`, which the account layout renders instead.
 */
export function AccountTopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 text-sm md:flex" aria-label="Account navigation">
      {TOP_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-control px-3 py-2 font-medium transition-colors',
              active ? 'bg-tint-teal text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
