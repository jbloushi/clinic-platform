import Link from 'next/link';
import { DoctorAvatar } from './avatar';
import { AppointmentStatusBadge, appointmentStatusBand } from './status-badge';
import { cn, formatPrice, formatRelativeDay, formatTime } from '@/lib/utils';
import type { AppointmentStatus } from '@/lib/data/types';

/**
 * Patient appointment card from the approved "My visits" design: a status-tinted
 * header band over the doctor row, with the actions that state allows.
 *
 * Takes plain display fields rather than a persistence model, so both platform
 * booking holds and provider-layer appointments can render through it.
 */
export function AppointmentCard({
  start,
  status,
  doctorName,
  doctorSpecialty,
  doctorPhotoUrl,
  serviceName,
  branchName,
  amountDueMinor,
  currency = 'KWD',
  rescheduleHref,
  cancelHref,
  payHref,
  footer,
  className,
}: {
  /** ISO start — drives both the relative day and the time line. */
  start: string;
  status: AppointmentStatus;
  doctorName?: string;
  doctorSpecialty?: string;
  doctorPhotoUrl?: string | null;
  serviceName?: string;
  branchName?: string;
  /** Outstanding balance; shown on the payment action when > 0. */
  amountDueMinor?: number;
  currency?: string;
  rescheduleHref?: string;
  cancelHref?: string;
  payHref?: string;
  /**
   * Arbitrary footer, for action sets the named props don't cover. Takes
   * precedence over them when supplied.
   */
  footer?: React.ReactNode;
  className?: string;
}) {
  const date = new Date(start);
  const exact = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  const relative = formatRelativeDay(start);
  const awaitingPayment = status === 'pending_payment' || status === 'held';

  // Detail line: time first, then wherever and whatever the visit is.
  const details = [formatTime(start), branchName, serviceName].filter(Boolean).join(' · ');

  return (
    <article className={cn('overflow-hidden rounded-card border bg-surface', className)}>
      <div
        className={cn(
          'flex items-center justify-between gap-3 px-4 py-2.5',
          appointmentStatusBand(status),
        )}
      >
        <p className="min-w-0 truncate text-[12px] font-semibold">
          <span>{relative}</span>
          <span className="opacity-70"> · {exact}</span>
        </p>
        <AppointmentStatusBadge status={status} className="shrink-0 bg-surface" />
      </div>

      <div className="flex items-center gap-3.5 p-[15px]">
        <DoctorAvatar
          name={doctorName ?? 'Specialist'}
          specialty={doctorSpecialty}
          photoUrl={doctorPhotoUrl}
          size={48}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">{doctorName ?? 'Specialist'}</p>
          {details && <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{details}</p>}
        </div>
      </div>

      {footer ? (
        <div className="border-t border-muted">{footer}</div>
      ) : awaitingPayment && payHref ? (
        <Link
          href={payHref}
          className="flex min-h-[48px] items-center justify-center border-t border-muted px-4 text-[13px] font-semibold text-primary hover:bg-tint-teal"
        >
          Complete payment
          {amountDueMinor && amountDueMinor > 0 ? ` · ${formatPrice(amountDueMinor, currency)}` : ''}
        </Link>
      ) : (
        (rescheduleHref || cancelHref) && (
          <div className="flex border-t border-muted">
            {rescheduleHref && (
              <Link
                href={rescheduleHref}
                className={cn(
                  'flex min-h-[48px] flex-1 items-center justify-center px-3 text-[13px] font-semibold text-primary hover:bg-tint-teal',
                  cancelHref && 'border-e border-muted',
                )}
              >
                Reschedule
              </Link>
            )}
            {cancelHref && (
              <Link
                href={cancelHref}
                className="flex min-h-[48px] flex-1 items-center justify-center px-3 text-[13px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Cancel
              </Link>
            )}
          </div>
        )
      )}
    </article>
  );
}
