'use client';

import { useRouter } from 'next/navigation';
import { Building2, CalendarClock, Check, Stethoscope, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export type BranchChoice = { slug: string; name: string; area: string };
export type DepartmentChoice = { slug: string; name: string };

const choices = [
  { key: 'service', title: 'Find by service', description: 'Choose the consultation or treatment you need.', icon: Stethoscope },
  { key: 'doctor', title: 'Find by doctor', description: 'Select a doctor, then see their available appointments.', icon: Users },
  { key: 'first', title: 'First available appointment', description: 'See the earliest suitable time across eligible doctors.', icon: CalendarClock },
] as const;

/**
 * Entry point of the booking funnel: branch first, then how to search.
 *
 * Branch gates everything after it because it decides which clinic the visit
 * actually happens at — a slot chosen before the location is a slot the patient
 * may not be able to attend. The later steps stay visible but inert until it's
 * picked, so the shape of the journey is legible from the first screen rather
 * than appearing one piece at a time.
 */
export function BookingEntry({
  branches,
  departments,
  initialDepartment,
  initialBranch,
  v2Enabled,
}: {
  branches: BranchChoice[];
  departments: DepartmentChoice[];
  initialDepartment?: string;
  initialBranch?: string;
  /** Shows a link to the new dual-journey booking flow, behind BOOKING_JOURNEY_V2_ENABLED. */
  v2Enabled?: boolean;
}) {
  const router = useRouter();
  const [branch, setBranch] = useState(initialBranch ?? '');
  const locked = !branch;

  function continueBooking(preference: (typeof choices)[number]['key']) {
    if (locked) return;
    const query = new URLSearchParams({ branch });
    if (initialDepartment) query.set('department', initialDepartment);

    if (preference === 'doctor') {
      if (initialDepartment) query.set('specialty', initialDepartment);
      router.push(`/doctors?${query}`);
      return;
    }
    if (preference === 'first') query.set('preference', 'first');
    router.push(`/book/service?${query}`);
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
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            Choose a branch above to continue.
          </p>
        )}
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {choices.map((choice) => {
            const Icon = choice.icon;
            return (
              <button
                key={choice.key}
                type="button"
                disabled={locked}
                onClick={() => continueBooking(choice.key)}
                className={cn(
                  'min-h-[152px] rounded-card border bg-surface p-5 text-start',
                  locked ? 'cursor-not-allowed' : 'card-hover press-scale',
                )}
              >
                <Icon className="h-6 w-6 text-primary" aria-hidden />
                <span className="mt-5 block text-[14.5px] font-semibold">{choice.title}</span>
                <span className="mt-2 block text-[12.5px] leading-relaxed text-muted-foreground">
                  {choice.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {v2Enabled && (
        <button
          type="button"
          disabled={locked}
          onClick={() => router.push(`/book/v2${branch ? `?branch=${branch}` : ''}`)}
          className={cn(
            'w-full rounded-card border border-dashed border-primary/40 bg-tint-teal/40 p-4 text-start text-[13px] font-medium text-primary',
            locked ? 'cursor-not-allowed opacity-45' : 'press-scale hover:border-primary',
          )}
        >
          Try our new booking experience →
        </button>
      )}

      <div aria-disabled={locked} className={cn(locked && 'opacity-45')}>
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Or start with a department
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {departments.map((department) => (
            <button
              key={department.slug}
              type="button"
              disabled={locked}
              onClick={() => router.push(`/book/service?department=${department.slug}&branch=${branch}`)}
              className={cn(
                'min-h-11 rounded-full border bg-surface px-4 py-2 text-[13px] font-medium',
                locked ? 'cursor-not-allowed' : 'press-scale hover:border-primary hover:text-primary',
              )}
            >
              {department.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
