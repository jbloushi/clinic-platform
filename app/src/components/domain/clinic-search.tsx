'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarHeart, Layers, Search, Stethoscope, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  KIND_LABEL,
  KIND_ORDER,
  searchClinicIndex,
  type SearchEntry,
  type SearchEntryKind,
} from '@/lib/search/clinic-search-index';

const KIND_ICON: Record<SearchEntryKind, LucideIcon> = {
  doctor: Stethoscope,
  service: CalendarHeart,
  department: Layers,
  reason: Search,
};

/**
 * One search field across doctors, services, departments and curated reasons for
 * visit, with results grouped by kind. Selecting a result opens that thing's own
 * page or booking context — the search never answers a clinical question, it
 * only routes.
 *
 * Implemented as an ARIA combobox over a flat candidate list, so arrow keys move
 * through results across group boundaries the way a patient expects.
 */
export function UnifiedClinicSearch({
  index,
  placeholder = 'Search doctor, service or reason for visit',
  variant = 'elevated',
  className,
}: {
  index: SearchEntry[];
  placeholder?: string;
  /** `elevated` is the homepage card that floats over the hero. */
  variant?: 'elevated' | 'inline';
  className?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => searchClinicIndex(index, query), [index, query]);

  const grouped = useMemo(() => {
    return KIND_ORDER.map((kind) => ({
      kind,
      entries: results.filter((entry) => entry.kind === kind),
    })).filter((group) => group.entries.length > 0);
  }, [results]);

  // Flat order must match render order for aria-activedescendant to line up.
  const flat = useMemo(() => grouped.flatMap((group) => group.entries), [grouped]);
  const showList = open && query.trim() !== '';

  function choose(entry: SearchEntry | undefined) {
    if (!entry) return;
    setOpen(false);
    router.push(entry.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (flat.length === 0 ? 0 : (i + 1) % flat.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (flat.length === 0 ? 0 : (i - 1 + flat.length) % flat.length));
    } else if (event.key === 'Enter') {
      if (showList && flat.length > 0) {
        event.preventDefault();
        choose(flat[activeIndex]);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  const activeId = showList && flat[activeIndex] ? `${listboxId}-${flat[activeIndex].id}` : undefined;

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'flex items-center gap-2 rounded-card border bg-surface ps-3.5 pe-1.5',
          variant === 'elevated' && 'shadow-[0_6px_20px_rgba(20,52,48,.08)]',
        )}
      >
        <Search className="h-[18px] w-[18px] shrink-0 text-placeholder" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-label={placeholder}
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Let a click on an option land before the list unmounts.
            window.setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={onKeyDown}
          className="h-[46px] min-w-0 flex-1 bg-transparent text-[14px] outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {showList && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Search results"
          className="absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-[min(60vh,380px)] overflow-y-auto rounded-card border bg-surface p-1.5 shadow-lg"
        >
          {flat.length === 0 ? (
            <p className="px-3 py-4 text-[13px] text-muted-foreground">
              Nothing matched “{query.trim()}”. Try a doctor’s name, a service, or a department.
            </p>
          ) : (
            grouped.map((group) => (
              <div key={group.kind} role="group" aria-label={KIND_LABEL[group.kind]} className="mb-1 last:mb-0">
                <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {KIND_LABEL[group.kind]}
                </p>
                {group.entries.map((entry) => {
                  const position = flat.indexOf(entry);
                  const active = position === activeIndex;
                  const Icon = KIND_ICON[entry.kind];
                  return (
                    <button
                      key={entry.id}
                      id={`${listboxId}-${entry.id}`}
                      role="option"
                      aria-selected={active}
                      type="button"
                      onMouseEnter={() => setActiveIndex(position)}
                      onClick={() => choose(entry)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start',
                        active ? 'bg-tint-teal' : 'hover:bg-muted',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold">{entry.label}</span>
                        {entry.sublabel && (
                          <span className="block truncate text-[11.5px] text-muted-foreground">
                            {entry.sublabel}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
