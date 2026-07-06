import { cn } from '@/lib/utils';
import { APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from '@/lib/data/types';

const STATUS_CLASSES: Record<AppointmentStatus, string> = {
  draft: 'bg-muted text-muted-foreground border-transparent',
  held: 'bg-amber-100 text-amber-800 border-amber-200',
  pending_payment: 'bg-orange-100 text-orange-800 border-orange-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  checked_in: 'bg-teal-100 text-teal-800 border-teal-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
  no_show: 'bg-red-100 text-red-800 border-red-200',
};

export function StatusBadge({ status, className }: { status: AppointmentStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        STATUS_CLASSES[status],
        className,
      )}
    >
      {APPOINTMENT_STATUS_LABEL[status]}
    </span>
  );
}
