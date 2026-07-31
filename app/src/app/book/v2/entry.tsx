'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, Stethoscope, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BranchChoice = { slug: string; name: string; area: string };

/**
 * Entry point of the new dual journey: branch first, then which of the two
 * paths (service-first / doctor-first) to take. Both paths converge on the
 * same hold-creation API — this component only decides which one the patient
 * starts from.
 */
export function V2Entry({ branches, initialBranch }: { branches: BranchChoice[]; initialBranch?: string }) {
  const router = useRouter();
  const [branch, setBranch] = useState(initialBranch ?? '');
  const locked = !branch;

  function go(path: 'service' | 'doctor') {
    if (locked) return;
    router.push(`/book/v2/${path}?branch=${encodeURIComponent(branch)}`);
  }

  return (
    <div className="space-y-8 pb-8">
      <fieldset>
        <legend className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          1 · Choose a branch
        </legend>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {branches.map((item) => {
            const active = branch === item.slug;
            return (
              <button
                key={item.slug}
                type="button"
                aria-pressed={active}
                onClick={() => setBranch(item.slug)}
                className={cn(
                  'press-scale flex min-h-[64px] items-center gap-3.5 rounded-card border bg-surface p-4 text-start',
                  active ? 'border-[1.5px] border-primary bg-tint-teal' : 'hover:border-primary/40',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px]',
                    active ? 'bg-primary text-primary-foreground' : 'bg-tint-teal text-primary',
                  )}
                >
                  {active ? <Check className="h-[18px] w-[18px]" strokeWidth={3} /> : <Building2 className="h-[18px] w-[18px]" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{item.name}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">{item.area}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset aria-disabled={locked} className={cn(locked && 'opacity-45')}>
        <legend className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          2 · How would you like to start?
        </legend>
        {locked && (
          <p className="mt-2 text-[12.5px] text-muted-foreground">Choose a branch above to continue.</p>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={locked}
            onClick={() => go('service')}
            className={cn(
              'min-h-[152px] rounded-card border bg-surface p-5 text-start',
              locked ? 'cursor-not-allowed' : 'card-hover press-scale',
            )}
          >
            <Stethoscope className="h-6 w-6 text-primary" aria-hidden />
            <span className="mt-5 block text-[14.5px] font-semibold">Find by service</span>
            <span className="mt-2 block text-[12.5px] leading-relaxed text-muted-foreground">
              Choose what you need. We&apos;ll find the earliest available doctor for it.
            </span>
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => go('doctor')}
            className={cn(
              'min-h-[152px] rounded-card border bg-surface p-5 text-start',
              locked ? 'cursor-not-allowed' : 'card-hover press-scale',
            )}
          >
            <Users className="h-6 w-6 text-primary" aria-hidden />
            <span className="mt-5 block text-[14.5px] font-semibold">Find by doctor</span>
            <span className="mt-2 block text-[12.5px] leading-relaxed text-muted-foreground">
              Pick a specific doctor, then their available appointments.
            </span>
          </button>
        </div>
      </fieldset>
    </div>
  );
}
