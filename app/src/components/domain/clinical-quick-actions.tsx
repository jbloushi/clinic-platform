'use client';

import { CalendarPlus, FlaskConical, Pill } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type QuickAction = {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
};

/**
 * The three quick clinical actions from the approved workspace: prescribe, order
 * an investigation, and book the follow-up.
 *
 * These open panels in place rather than navigating — losing an in-progress note
 * to a page change is the failure this layout exists to prevent, so the handlers
 * stay with the workspace that owns the draft.
 */
export function ClinicalQuickActions({
  actions,
  className,
}: {
  actions: QuickAction[];
  className?: string;
}) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-3', className)}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.key}
            type="button"
            onClick={action.onSelect}
            disabled={action.disabled}
            className="press-scale card-hover flex flex-col items-start rounded-md border bg-surface p-3.5 text-start disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-primary">
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {action.label}
            </span>
            <span className="mt-1 text-[11.5px] text-muted-foreground">{action.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Default action set, so the workspace only supplies handlers. */
export function defaultQuickActions({
  onPrescribe,
  onOrder,
  onFollowUp,
  disabled,
}: {
  onPrescribe: () => void;
  onOrder: () => void;
  onFollowUp: () => void;
  disabled?: boolean;
}): QuickAction[] {
  return [
    {
      key: 'prescription',
      label: 'Prescription',
      hint: 'Issue medication',
      icon: Pill,
      onSelect: onPrescribe,
      disabled,
    },
    {
      key: 'order',
      label: 'Lab / imaging',
      hint: 'Order investigation',
      icon: FlaskConical,
      onSelect: onOrder,
      disabled,
    },
    {
      key: 'followup',
      label: 'Follow-up',
      hint: 'Schedule next visit',
      icon: CalendarPlus,
      onSelect: onFollowUp,
      disabled,
    },
  ];
}
