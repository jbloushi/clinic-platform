'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, House, Plus, Stethoscope, User } from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  /** Full label for assistive technology. */
  label: string;
  /** Short visible label under the icon. */
  short: string;
  icon: typeof House;
};

const ITEMS: NavItem[] = [
  { href: '/', label: 'Clinic home', short: 'Home', icon: House },
  { href: '/doctors', label: 'Find a doctor', short: 'Doctors', icon: Stethoscope },
  { href: '/account/appointments', label: 'My visits', short: 'Visits', icon: CalendarDays },
  { href: '/account/profile', label: 'My account', short: 'Account', icon: User },
];

/** Central elevated gold action, rendered between items 2 and 3. */
const BOOK = { href: '/book/v2', label: 'Book an appointment' };

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

/**
 * Mobile patient navigation: four tabs around an elevated gold "Book" action.
 *
 * Fixed to the bottom and hidden from `md` up, where the top navigation takes
 * over. It is safe-area aware; pages that render it must also carry the
 * `has-mobile-nav` class so their content is never hidden underneath.
 *
 * Direction-agnostic — the row is DOM-ordered, so it mirrors correctly under
 * `dir="rtl"` without a second layout.
 */
export function PatientMobileNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const bookActive = isActive(pathname, BOOK.href);

  return (
    <nav
      aria-label="Patient navigation"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t bg-surface/95 backdrop-blur-md md:hidden',
        className,
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-3 pt-1.5">
        {ITEMS.slice(0, 2).map((item) => (
          <Tab key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}

        <li className="flex w-[68px] shrink-0 justify-center">
          <Link
            href={BOOK.href}
            aria-label={BOOK.label}
            aria-current={bookActive ? 'page' : undefined}
            className={cn(
              'accent-gradient press-scale -mt-5 flex h-[52px] w-[52px] items-center justify-center rounded-[16px] text-white shadow-[0_8px_18px_rgba(192,152,63,.4)] ring-4 ring-background',
              bookActive && 'ring-accent/30',
            )}
          >
            <Plus className="h-6 w-6" aria-hidden />
          </Link>
        </li>

        {ITEMS.slice(2).map((item) => (
          <Tab key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </ul>
    </nav>
  );
}

function Tab({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li className="flex flex-1 justify-center">
      <Link
        href={item.href}
        aria-label={item.label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex min-h-[52px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-md px-1 pb-1 text-[10px] transition-colors',
          active ? 'font-semibold text-primary' : 'font-medium text-muted-foreground',
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden />
        {item.short}
      </Link>
    </li>
  );
}
