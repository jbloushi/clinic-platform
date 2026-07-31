import Link from 'next/link';
import { Activity, HeartPulse, Salad, Scan, Scissors, Stethoscope } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { specialtyColor } from '@/lib/specialty-colors';

/**
 * Department glyphs. Keyed by the catalogue slug so a new department falls back
 * to the generic stethoscope rather than breaking the grid.
 */
const ICONS: Record<string, LucideIcon> = {
  'bariatric-surgery': Activity,
  gastroenterology: Scan,
  nutrition: Salad,
  'plastic-surgery': Scissors,
  'general-surgery': HeartPulse,
};

/**
 * Compact department tile from the approved homepage grid: a soft specialty-
 * tinted icon chip over a two-line label. Kept small and scannable — two across
 * on mobile, more on wider screens.
 */
export function DepartmentTile({
  slug,
  name,
  summary,
  href,
  className,
}: {
  slug: string;
  name: string;
  /** One short line — what the department covers. */
  summary?: string;
  href?: string;
  className?: string;
}) {
  const Icon = ICONS[slug] ?? Stethoscope;
  const color = specialtyColor(name);

  return (
    <Link
      href={href ?? `/departments/${slug}`}
      className={cn(
        'card-hover flex flex-col rounded-card border bg-surface p-3.5',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mb-2.5 inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px]',
          color.soft,
        )}
      >
        <Icon className="h-[17px] w-[17px]" />
      </span>
      <span className="text-[13.5px] font-semibold leading-[1.15]">{name}</span>
      {summary && (
        <span className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-muted-foreground">
          {summary}
        </span>
      )}
    </Link>
  );
}
