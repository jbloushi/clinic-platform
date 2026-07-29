'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, FileText, Home, Stethoscope, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/', label: 'Home', short: 'Home', icon: Home },
  { href: '/doctors', label: 'Doctors', short: 'Doctors', icon: Stethoscope },
  { href: '/book', label: 'Book appointment', short: 'Book', icon: CalendarDays, primary: true },
  { href: '/account/appointments', label: 'Appointments', short: 'Visits', icon: CalendarDays },
  { href: '/account/profile', label: 'Account', short: 'Account', icon: User },
];

const TOP_ITEMS = [
  { href: '/account/appointments', label: 'Appointments' },
  { href: '/account/records', label: 'Medical records', icon: FileText },
  { href: '/account/profile', label: 'Profile' },
  { href: '/book', label: 'Book' },
];

/** Desktop: inline text links in the top bar. */
export function AccountTopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 text-sm sm:flex">
      {TOP_ITEMS.map((it) => {
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
      <div className="mx-auto grid max-w-md grid-cols-5 px-1 pt-1">
        {ITEMS.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + '/');
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground',
                it.primary && '-mt-5',
              )}
            >
              <span className={cn(it.primary && 'flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-md ring-4 ring-background')}>
                <Icon className={cn('h-5 w-5', active && !it.primary && 'text-primary')} />
              </span>
              {it.short}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
