import {
  Ban,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  CircleSlash,
  Clock,
  LogIn,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from '@/lib/data/types';

type StatusTreatment = {
  /** Badge surface/text/border. */
  badge: string;
  /** Card header band surface + ink, for AppointmentCard. */
  band: string;
  /** Paired with the label so status never depends on color alone. */
  icon: LucideIcon;
};

/**
 * Approved status treatments: a teal family for confirmed/in-progress states, a
 * warm gold family for anything awaiting patient action, success green for
 * completed, neutral sand for cancelled, and a clear destructive red for
 * no-show. Every treatment carries an icon so the state is legible without
 * color — required for accessibility and for print/greyscale.
 */
const TREATMENTS: Record<AppointmentStatus, StatusTreatment> = {
  draft: {
    badge: 'bg-muted text-muted-foreground border-tint-neutral-border',
    band: 'bg-muted text-muted-foreground',
    icon: CircleDashed,
  },
  held: {
    badge: 'bg-tint-gold text-accent-foreground border-tint-gold-border',
    band: 'bg-tint-gold text-accent-foreground',
    icon: Clock,
  },
  pending_payment: {
    badge: 'bg-tint-gold text-accent-foreground border-tint-gold-border',
    band: 'bg-tint-gold text-accent-foreground',
    icon: Wallet,
  },
  confirmed: {
    badge: 'bg-tint-teal text-primary border-tint-teal-border',
    band: 'bg-tint-teal text-primary',
    icon: CalendarClock,
  },
  checked_in: {
    badge: 'bg-tint-teal text-primary border-tint-teal-border',
    band: 'bg-tint-teal text-primary',
    icon: LogIn,
  },
  completed: {
    badge: 'bg-[#E7F0E4] text-[#2F5B22] border-[#D2E3CA]',
    band: 'bg-[#E7F0E4] text-[#2F5B22]',
    icon: CheckCircle2,
  },
  cancelled: {
    badge: 'bg-muted text-muted-foreground border-tint-neutral-border',
    band: 'bg-muted text-muted-foreground',
    icon: CircleSlash,
  },
  no_show: {
    badge: 'bg-[#F7E5E3] text-[#8A2E24] border-[#EBCFCB]',
    band: 'bg-[#F7E5E3] text-[#8A2E24]',
    icon: Ban,
  },
};

/** Header-band classes for a status, so cards and badges stay in step. */
export function appointmentStatusBand(status: AppointmentStatus): string {
  return TREATMENTS[status].band;
}

export function AppointmentStatusBadge({
  status,
  className,
}: {
  status: AppointmentStatus;
  className?: string;
}) {
  const treatment = TREATMENTS[status];
  const Icon = treatment.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
        treatment.badge,
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {APPOINTMENT_STATUS_LABEL[status]}
    </span>
  );
}

/** Existing name kept so ops/doctor screens don't need touching. */
export const StatusBadge = AppointmentStatusBadge;
