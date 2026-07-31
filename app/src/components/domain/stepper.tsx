import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Step = { key: string; label: string };

/**
 * Booking progress indicator.
 *
 * Labels stay visible at every width — on a booking flow the patient needs to
 * know which decision they're on, and that's exactly the screen size where the
 * context is scarcest. Completed steps carry a check rather than their number,
 * so "done" reads without relying on colour.
 */
export function Stepper({
  steps,
  current,
  className,
}: {
  steps: Step[];
  current: number;
  className?: string;
}) {
  return (
    <ol className={cn('flex items-start', className)} aria-label="Booking progress">
      {steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'active' : 'pending';
        const complete = state === 'done';

        return (
          <li key={step.key} className="flex flex-1 items-start last:flex-none">
            <div className="flex w-full flex-col items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums',
                  state === 'pending'
                    ? 'bg-border text-muted-foreground'
                    : 'bg-primary text-primary-foreground',
                )}
              >
                {complete ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
              </span>
              <span
                className={cn(
                  'text-center text-[10px] leading-tight',
                  state === 'pending' ? 'font-medium text-muted-foreground' : 'font-semibold text-primary',
                )}
              >
                {step.label}
                {state === 'active' && <span className="sr-only"> (current step)</span>}
                {complete && <span className="sr-only"> (completed)</span>}
              </span>
            </div>

            {index < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'mt-[12px] h-0.5 flex-1 rounded-full',
                  index < current ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
