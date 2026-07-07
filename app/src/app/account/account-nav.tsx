'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, FileText, Stethoscope, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/account/appointments', label: 'Appointments', short: 'Visits', icon: CalendarDays },
  { href: '/account/records', label: 'Records', short: 'Records', icon: FileText },
  { href: '/account/profile', label: 'Profile', short: 'Profile', icon: User },
  { href: '/doctors', label: 'Book', short: 'Book', icon: Stethoscope },
];

/** Desktop: inline text links in the top bar. */
export function AccountTopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 text-sm sm:flex">
      {ITEMS.map((it) => {
        const active = pathname === it.href || pathname.startsWith(it.href + '/');
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 font-medium transition-colors',
              active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile: fixed bottom tab bar, safe-area aware. */
export function AccountBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur-md sm:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Account navigation"
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {ITEMS.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + '/');
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'text-primary')} />
              {it.short}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
