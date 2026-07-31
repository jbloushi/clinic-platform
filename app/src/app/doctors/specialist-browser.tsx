'use client';

import { useMemo, useState } from 'react';
import { Search, Stethoscope, X } from 'lucide-react';
import { DoctorCard } from '@/components/domain/doctor-card';
import { EmptyState } from '@/components/domain/states';
import { cn } from '@/lib/utils';
import { specialtyColor } from '@/lib/specialty-colors';
import type { NextAvailable } from '@/lib/specialist-meta';
import type { Practitioner } from '@/lib/data/types';

type AvailabilityFilter = 'any' | 'today' | 'week';

const AVAILABILITY_LABEL: Record<AvailabilityFilter, string> = {
  any: 'Any time',
  today: 'Available today',
  week: 'Available this week',
};

/**
 * Client-side filtering for the specialist directory.
 *
 * The server hands over the full active roster plus each specialist's real
 * next-available slot, so typing and tapping filters in-memory — no round-trip,
 * no Search button. Filters are limited to things the platform actually knows:
 * name, specialty, and provider-computed availability.
 */
const key = (value: string) => value.trim().toLowerCase();

export function SpecialistBrowser({
  specialists,
  nextAvailable,
  branchSlug,
  initialSpecialties = [],
}: {
  specialists: Practitioner[];
  nextAvailable: Record<string, NextAvailable>;
  /** Branch already chosen in the booking funnel, carried into each card's links. */
  branchSlug?: string;
  /**
   * Specialty values to pre-filter by — a department maps to several, so this
   * is a set rather than one string. Matched case-insensitively, because these
   * come from a curated mapping while the practitioner's own value is free text
   * typed into OpenEMR.
   */
  initialSpecialties?: string[];
}) {
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('');
  // Narrowing from the department view: a chip selection replaces it entirely,
  // so the patient is never filtered by two things they can only see one of.
  const [scoped, setScoped] = useState(() => new Set(initialSpecialties.map(key)));
  const [availability, setAvailability] = useState<AvailabilityFilter>('any');

  const specialties = useMemo(
    () => Array.from(new Set(specialists.map((s) => s.specialty).filter(Boolean))).sort(),
    [specialists],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const today = new Date().toDateString();

    return specialists.filter((specialist) => {
      // Set membership, matched on a normalised key. A strict `!==` against one
      // string could never match a department, whose specialties are several
      // values entered by hand in OpenEMR.
      if (specialty) {
        if (key(specialist.specialty) !== key(specialty)) return false;
      } else if (scoped.size > 0 && !scoped.has(key(specialist.specialty))) {
        return false;
      }

      if (availability !== 'any') {
        const slot = nextAvailable[specialist.id];
        if (!slot) return false;
        if (availability === 'today' && new Date(slot.iso).toDateString() !== today) return false;
      }

      if (!term) return true;
      return `${specialist.title} ${specialist.firstName} ${specialist.lastName} ${specialist.specialty}`
        .toLowerCase()
        .includes(term);
    });
  }, [specialists, query, specialty, scoped, availability, nextAvailable]);

  const anyFilterOn =
    query.trim() !== '' || specialty !== '' || scoped.size > 0 || availability !== 'any';

  return (
    <div>
      {/* Sticks below the site header rather than at the viewport edge — the
          header is `sticky top-0` at a higher z-index, so top-0 here would
          slide the filters underneath it. */}
      <div className="sticky top-16 z-30 -mx-5 border-b bg-surface px-5 pb-3.5 pt-3 md:-mx-8 md:px-8">
        <div className="mx-auto max-w-4xl space-y-3">
          <div className="flex items-center gap-2.5 rounded-control border bg-background ps-3 pe-1.5">
            <Search className="h-[17px] w-[17px] shrink-0 text-placeholder" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name or specialty"
              aria-label="Search specialists by name or specialty"
              className="h-[44px] min-w-0 flex-1 bg-transparent text-[14px] outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>

          <div className="rail" role="group" aria-label="Filter by specialty">
            <Chip
              label="All"
              active={specialty === '' && scoped.size === 0}
              onClick={() => {
                setSpecialty('');
                setScoped(new Set());
              }}
            />
            {specialties.map((item) => {
              const color = specialtyColor(item);
              const active = specialty === item;
              return (
                <Chip
                  key={item}
                  label={item}
                  active={active}
                  dotClass={color.dot}
                  onClick={() => {
                    // Picking a chip replaces the department scope — two
                    // filters where only one is visible reads as a bug.
                    setScoped(new Set());
                    setSpecialty(active ? '' : item);
                  }}
                />
              );
            })}
          </div>

          <div className="rail" role="group" aria-label="Filter by availability">
            {(Object.keys(AVAILABILITY_LABEL) as AvailabilityFilter[]).map((value) => (
              <Chip
                key={value}
                label={AVAILABILITY_LABEL[value]}
                active={availability === value}
                onClick={() => setAvailability(value)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl pt-4">
        <div className="mb-3 flex items-center justify-between gap-3 text-[12.5px]">
          <p className="text-muted-foreground" aria-live="polite">
            <span className="font-semibold text-foreground">{filtered.length}</span>{' '}
            {filtered.length === 1 ? 'specialist' : 'specialists'}
            {specialty ? ` in ${specialty}` : ''}
          </p>
          {anyFilterOn && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSpecialty('');
                setScoped(new Set());
                setAvailability('any');
              }}
              className="font-semibold text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-card border bg-surface">
            <EmptyState
              icon={<Stethoscope className="h-5 w-5" />}
              title="No matching specialists"
              description="Try a different name, specialty, or widen the availability filter."
            />
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map((specialist) => (
              <DoctorCard
                key={specialist.id}
                specialist={specialist}
                nextAvailable={nextAvailable[specialist.id]}
                branchSlug={branchSlug}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  dotClass,
  onClick,
}: {
  label: string;
  active: boolean;
  dotClass?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'press-scale inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'bg-surface text-foreground/75 hover:bg-muted',
      )}
    >
      {dotClass && !active && <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', dotClass)} />}
      {label}
    </button>
  );
}
