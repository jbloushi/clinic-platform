import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Step = { key: string; label: string };

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
    <ol className={cn('flex items-center gap-2', className)} aria-label="Progress">
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'pending';
        return (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 tabular-nums',
                state === 'done' && 'bg-primary text-primary-foreground ring-primary',
                state === 'active' && 'bg-primary/10 text-primary ring-primary',
                state === 'pending' && 'bg-muted text-muted-foreground ring-border',
              )}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              {state === 'done' ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                'hidden text-xs font-medium sm:inline-block',
                state === 'pending' ? 'text-muted-foreground' : 'text-foreground',
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'ml-1 flex-1 rounded-full',
                  'h-0.5',
                  i < current ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
