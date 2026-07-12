'use client';

import { useMemo, useState } from 'react';
import { Search, Stethoscope, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/domain/states';
import { SpecialistCard } from '@/components/domain/specialist-card';
import { cn } from '@/lib/utils';
import { specialtyColor } from '@/lib/specialty-colors';
import type { NextAvailable } from '@/lib/specialist-meta';
import type { Practitioner } from '@/lib/data/types';

/**
 * Client-side live filtering for the public specialist listing. The server hands us
 * the full active list once; we filter in-memory as the user types or taps a
 * specialty — no Search button, no round-trips. Mobile-first: full-width search,
 * horizontally-wrapping color-coded specialty chips.
 */
export function SpecialistBrowser({
  specialists,
  nextAvailable,
}: {
  specialists: Practitioner[];
  nextAvailable: Record<string, NextAvailable>;
}) {
  const [q, setQ] = useState('');
  const [specialty, setSpecialty] = useState('');

  const specialties = useMemo(
    () => Array.from(new Set(specialists.map((s) => s.specialty))).sort(),
    [specialists],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return specialists.filter((sp) => {
      if (specialty && sp.specialty !== specialty) return false;
      if (!s) return true;
      return `${sp.title} ${sp.firstName} ${sp.lastName} ${sp.specialty}`.toLowerCase().includes(s);
    });
  }, [specialists, q, specialty]);

  const active = q.trim() !== '' || specialty !== '';

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or specialty…"
          className="h-11 w-full pl-9 pr-9 text-base"
          aria-label="Search specialists"
          type="search"
          inputMode="search"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Color-coded specialty chips */}
      <div className="flex flex-wrap gap-2">
        <FilterChip label="All" active={specialty === ''} onClick={() => setSpecialty('')} />
        {specialties.map((s) => {
          const c = specialtyColor(s);
          const on = specialty === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSpecialty(on ? '' : s)}
              aria-pressed={on}
              className={cn(
                'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors press-scale',
                on ? c.pill : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
              {s}
            </button>
          );
        })}
      </div>

      {/* Result count / clear */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filtered.length}</span>{' '}
          {filtered.length === 1 ? 'specialist' : 'specialists'}
          {specialty ? ` in ${specialty}` : ''}
        </p>
        {active && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              setSpecialty('');
            }}
            className="font-medium text-primary hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Stethoscope className="h-5 w-5" />}
              title="No matching specialists"
              description="Try a different name or specialty."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <SpecialistCard key={s.id} specialist={s} nextAvailable={nextAvailable[s.id]} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-[44px] items-center rounded-full border px-3 text-sm font-medium transition-colors press-scale',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}
