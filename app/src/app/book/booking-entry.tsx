'use client';

import { useRouter } from 'next/navigation';
import { CalendarClock, Stethoscope, Users } from 'lucide-react';
import { departments } from '@/lib/clinic-catalog';
import { branches } from '@/lib/clinic-catalog';
import { useState } from 'react';

const choices = [
  { key: 'service', title: 'Find by service', description: 'Choose the consultation or treatment you need.', icon: Stethoscope },
  { key: 'doctor', title: 'Find by doctor', description: 'Select a doctor, then see their available appointments.', icon: Users },
  { key: 'first', title: 'First available appointment', description: 'See the earliest suitable time across eligible doctors.', icon: CalendarClock },
] as const;

export function BookingEntry({ initialDepartment, initialBranch }: { initialDepartment?: string; initialBranch?: string }) {
  const router = useRouter();
  const [branch, setBranch] = useState(initialBranch ?? '');

  function continueBooking(preference: (typeof choices)[number]['key']) {
    if (preference === 'doctor') {
      router.push(initialDepartment ? `/doctors?specialty=${encodeURIComponent(initialDepartment)}` : '/doctors');
      return;
    }
    const query = new URLSearchParams();
    if (initialDepartment) query.set('department', initialDepartment);
    if (branch) query.set('branch', branch);
    if (preference === 'first') query.set('preference', 'first');
    router.push(`/book/service${query.size ? `?${query}` : ''}`);
  }

  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="text-sm font-semibold text-muted-foreground">Choose a branch</legend>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {branches.map((item) => (
            <button key={item.slug} type="button" aria-pressed={branch === item.slug} onClick={() => setBranch(item.slug)} className={branch === item.slug ? 'min-h-12 rounded-md border border-primary bg-primary/10 px-4 text-sm font-semibold text-primary' : 'min-h-12 rounded-md border bg-card px-4 text-sm font-medium'}>
              {item.name.en}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold text-muted-foreground">How would you like to start?</legend>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {choices.map((choice) => {
            const Icon = choice.icon;
            return (
              <button key={choice.key} type="button" onClick={() => continueBooking(choice.key)} className="min-h-40 rounded-xl border bg-card p-5 text-start card-hover">
                <Icon className="h-6 w-6 text-primary" aria-hidden />
                <span className="mt-5 block font-semibold">{choice.title}</span>
                <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">{choice.description}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground">Or start with a department</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {departments.map((department) => (
            <button key={department.slug} type="button" onClick={() => router.push(`/book/service?department=${department.slug}${branch ? `&branch=${branch}` : ''}`)} className="min-h-11 rounded-full border bg-card px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary">
              {department.name.en}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
