import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { EmptyState } from './states';

export type MedicalTimelineKind = 'visit' | 'prescription' | 'result' | 'document';

export type MedicalTimelineEntry = {
  id: string;
  kind: MedicalTimelineKind;
  /**
   * ISO date/time of the entry. Optional because some provider records (an
   * ongoing medication, for instance) have no meaningful date — those render
   * without a date line rather than being stamped with a made-up one.
   */
  date?: string;
  title: string;
  /** Who the patient saw — shown under the title when known. */
  provider?: string;
  /** One patient-friendly paragraph. Never internal clinical notes. */
  summary?: string;
  /** Short list rows, e.g. dispensed medications. */
  lines?: string[];
  badge?: { label: string; tone: 'teal' | 'gold' | 'neutral' };
  /** Only pass when the viewer is authorised to open the underlying document. */
  actionHref?: string;
  actionLabel?: string;
};

const DOT: Record<MedicalTimelineKind, string> = {
  visit: 'bg-primary',
  prescription: 'bg-accent',
  result: 'bg-[#5B8C3E]',
  document: 'bg-divider',
};

const BADGE_TONE = {
  teal: 'bg-tint-teal text-primary',
  gold: 'bg-tint-gold text-accent-foreground',
  neutral: 'bg-muted text-muted-foreground',
} as const;

/**
 * Read-only patient history timeline from the approved records design.
 *
 * Entries are rendered exactly as handed in: the caller is responsible for
 * mapping provider data into patient-friendly language and for withholding
 * `actionHref` when the viewer isn't authorised to open the document. This
 * component never derives clinical meaning of its own.
 */
export function MedicalTimeline({
  entries,
  emptyTitle = 'Nothing recorded yet',
  emptyDescription,
  className,
}: {
  entries: MedicalTimelineEntry[];
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}) {
  if (entries.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ol className={cn('flex flex-col', className)}>
      {entries.map((entry, index) => {
        const last = index === entries.length - 1;
        return (
          <li key={entry.id} className="flex gap-3.5">
            <div className="flex flex-col items-center" aria-hidden>
              <span className={cn('mt-1.5 h-[11px] w-[11px] rounded-full', DOT[entry.kind])} />
              {!last && <span className="w-0.5 flex-1 bg-border" />}
            </div>

            <div className={cn('flex-1', !last && 'pb-[18px]')}>
              {entry.date && (
                <p className="mb-1.5 text-[11.5px] text-muted-foreground">
                  <time dateTime={entry.date}>{formatDate(entry.date)}</time>
                </p>
              )}

              <div className="rounded-card border bg-surface p-[15px]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-semibold leading-snug">{entry.title}</h3>
                    {entry.provider && (
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground">{entry.provider}</p>
                    )}
                  </div>
                  {entry.badge && (
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                        BADGE_TONE[entry.badge.tone],
                      )}
                    >
                      {entry.badge.label}
                    </span>
                  )}
                </div>

                {entry.summary && (
                  <p className="mt-2.5 text-[12.5px] leading-relaxed text-foreground/75">
                    {entry.summary}
                  </p>
                )}

                {entry.lines && entry.lines.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-[12.5px] leading-relaxed text-foreground/75">
                    {entry.lines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                )}

                {entry.actionHref && (
                  <Link
                    href={entry.actionHref}
                    className="mt-2.5 inline-flex min-h-[44px] items-center gap-1.5 text-[12.5px] font-semibold text-primary hover:underline"
                  >
                    {entry.actionLabel ?? 'View'}
                    <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
                  </Link>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
