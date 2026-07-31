import Link from 'next/link';
import { Building2, Languages } from 'lucide-react';
import { DoctorAvatar } from './avatar';
import { cn, formatPrice } from '@/lib/utils';
import { specialtyColor } from '@/lib/specialty-colors';
import { formatSpecialistRole, type NextAvailable } from '@/lib/specialist-meta';
import type { Practitioner } from '@/lib/data/types';

/**
 * Compact specialist card from the approved directory.
 *
 * Shows only authoritative fields: identity, specialty, configured role, the
 * configured consultation fee, and provider-derived availability. Ratings and
 * procedure counts appear in the mockup but are deliberately omitted — the
 * platform has no source for them, and inventing clinical credibility signals
 * isn't acceptable.
 *
 * `branches` and `languages` render only when a caller can supply them. Neither
 * has a data source yet (doctor–branch mapping is platform-DB work), so today
 * they stay absent rather than being faked.
 */
export function DoctorCard({
  specialist,
  nextAvailable,
  branches,
  languages,
  branchSlug,
  className,
}: {
  specialist: Practitioner;
  nextAvailable?: NextAvailable;
  branches?: string[];
  languages?: string[];
  /** Carried into the profile link so the booking funnel keeps the chosen branch. */
  branchSlug?: string;
  className?: string;
}) {
  const fullName = `${specialist.title} ${specialist.firstName} ${specialist.lastName}`.trim();
  const color = specialtyColor(specialist.specialty);
  const roleLabel = formatSpecialistRole(specialist.role);
  const showFee = specialist.consultationFeeMinor > 0;
  const profileHref = `/doctors/${specialist.id}${branchSlug ? `?branch=${branchSlug}` : ''}`;

  return (
    <article
      className={cn(
        'card-hover rounded-card border bg-surface p-[15px] shadow-[0_1px_2px_rgba(20,52,48,.04)]',
        className,
      )}
    >
      <div className="flex items-center gap-3.5">
        <DoctorAvatar
          name={`${specialist.firstName} ${specialist.lastName}`}
          specialty={specialist.specialty}
          photoUrl={specialist.photoUrl}
          size={54}
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14.5px] font-semibold leading-[1.15]">
            <Link href={profileHref} className="text-foreground hover:text-primary">
              {fullName}
            </Link>
          </h3>
          {roleLabel && (
            <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{roleLabel}</p>
          )}
          <span
            className={cn(
              'mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold',
              color.pill,
            )}
          >
            <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', color.dot)} />
            {specialist.specialty}
          </span>
        </div>
      </div>

      {(branches?.length || languages?.length) && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
          {branches?.length ? (
            <li className="inline-flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {branches.join(' · ')}
            </li>
          ) : null}
          {languages?.length ? (
            <li className="inline-flex items-center gap-1.5">
              <Languages className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {languages.join(' · ')}
            </li>
          ) : null}
        </ul>
      )}

      <div className="mt-3.5 flex items-end justify-between gap-3 border-t border-muted pt-3.5">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">Next available</p>
          <p
            className={cn(
              'mt-0.5 truncate text-[13px] font-semibold',
              nextAvailable ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {nextAvailable?.label ?? 'No open times this week'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          {showFee && (
            <span className="font-editorial text-[14px] font-semibold tabular-nums">
              {formatPrice(specialist.consultationFeeMinor, specialist.currency)}
            </span>
          )}
          <Link
            href={profileHref}
            className="press-scale inline-flex min-h-[44px] items-center rounded-control px-2.5 text-[13px] font-semibold text-primary hover:bg-tint-teal"
          >
            Profile
          </Link>
          <Link
            href={`${profileHref}#booking`}
            aria-label={`Book an appointment with ${fullName}`}
            className="press-scale inline-flex min-h-[44px] items-center rounded-control bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Book
          </Link>
        </div>
      </div>
    </article>
  );
}
