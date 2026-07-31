'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

export type BranchOption = {
  slug: string;
  label: string;
  /** When set, this branch renders as a link to that destination. */
  href?: string;
};

/**
 * Segmented branch selector from the approved hero and doctor profile.
 *
 * Two modes so the same control serves both jobs:
 *  - options carrying `href` render as links (homepage hero, where picking a
 *    branch starts a booking);
 *  - otherwise they're controlled buttons driven by `onSelect` (filtering
 *    something already on screen).
 *
 * The destination lives on each option rather than in a callback because a
 * server component must be able to render this — functions can't cross the
 * server/client boundary as props.
 *
 * `variant="on-brand"` is for the teal hero: the selected branch becomes a sand
 * tile with teal ink, unselected branches stay translucent.
 */
export function BranchSelector({
  branches,
  value,
  onSelect,
  variant = 'surface',
  label = 'Choose a branch',
  className,
}: {
  branches: BranchOption[];
  value?: string;
  onSelect?: (slug: string) => void;
  variant?: 'surface' | 'on-brand';
  label?: string;
  className?: string;
}) {
  const onBrand = variant === 'on-brand';

  function classesFor(active: boolean): string {
    if (onBrand) {
      return active
        ? 'bg-surface-soft text-primary'
        : 'border border-white/[.28] bg-white/[.14] text-surface-soft';
    }
    return active
      ? 'bg-primary text-primary-foreground'
      : 'border bg-surface text-foreground/80 hover:bg-muted';
  }

  const shared =
    'press-scale flex min-h-[44px] flex-1 items-center justify-center rounded-control px-3 text-[13.5px] font-semibold transition-colors';

  return (
    <div className={cn('flex gap-2.5', className)} role="group" aria-label={label}>
      {branches.map((branch) => {
        const active = branch.slug === value;
        if (branch.href) {
          return (
            <Link
              key={branch.slug}
              href={branch.href}
              aria-current={active ? 'true' : undefined}
              className={cn(shared, classesFor(active))}
            >
              {branch.label}
            </Link>
          );
        }
        return (
          <button
            key={branch.slug}
            type="button"
            onClick={() => onSelect?.(branch.slug)}
            aria-pressed={active}
            className={cn(shared, classesFor(active))}
          >
            {branch.label}
          </button>
        );
      })}
    </div>
  );
}
