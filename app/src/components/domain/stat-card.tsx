import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

/**
 * KPI tile. Icon in a soft ring, big tabular number, optional delta chip.
 */
export function StatCard({
  icon,
  label,
  value,
  delta,
  helper,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  delta?: { value: string; direction?: 'up' | 'down' | 'flat' };
  helper?: string;
  className?: string;
}) {
  return (
    <Card className={cn('card-hover', className)}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums leading-tight tracking-tight text-foreground">
              {value}
            </p>
            {(delta || helper) && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                {delta && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium',
                      delta.direction === 'up' && 'bg-emerald-100 text-emerald-800',
                      delta.direction === 'down' && 'bg-red-100 text-red-800',
                      (!delta.direction || delta.direction === 'flat') && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {delta.direction === 'up' && '↑'}
                    {delta.direction === 'down' && '↓'}
                    {delta.value}
                  </span>
                )}
                {helper && <span className="text-muted-foreground">{helper}</span>}
              </div>
            )}
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
