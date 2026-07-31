import Link from 'next/link';
import { DoctorAvatar } from './avatar';
import { cn, formatTime } from '@/lib/utils';

/**
 * The appointment-in-progress card shown above each booking step, so the patient
 * can always see what they're confirming without scrolling back.
 *
 * `editHref` returns them to slot selection with their choice intact — the
 * design's "Edit" affordance.
 */
export function BookingSummary({
  doctorName,
  doctorSpecialty,
  doctorPhotoUrl,
  start,
  branchName,
  serviceName,
  editHref,
  className,
}: {
  doctorName?: string;
  doctorSpecialty?: string;
  doctorPhotoUrl?: string | null;
  /** ISO start of the held slot. */
  start: string;
  branchName?: string;
  serviceName?: string;
  editHref?: string;
  className?: string;
}) {
  const date = new Date(start);
  const when = `${date.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })} · ${formatTime(start)}`;

  const detail = [when, branchName].filter(Boolean).join(' · ');

  return (
    <div className={cn('flex items-center gap-3.5 rounded-card border bg-surface p-[15px]', className)}>
      <DoctorAvatar
        name={doctorName ?? 'Any available specialist'}
        specialty={doctorSpecialty}
        photoUrl={doctorPhotoUrl}
        size={46}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold">
          {doctorName ?? 'Any available specialist'}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{detail}</p>
        {serviceName && (
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{serviceName}</p>
        )}
      </div>
      {editHref && (
        <Link
          href={editHref}
          className="inline-flex min-h-[44px] shrink-0 items-center rounded-control px-2 text-[12.5px] font-semibold text-primary hover:bg-tint-teal"
        >
          Edit
        </Link>
      )}
    </div>
  );
}
