import { visitReasons } from '@/lib/visit-reasons';
import type { Locale } from '@/lib/i18n';
import type { Practitioner } from '@/lib/data/types';
import type { BookableService } from '@/lib/data/service-catalog';

export type SearchDepartment = {
  slug: string;
  nameEn: string;
  nameAr: string;
};

/**
 * Unified clinic search: one index over the four things a patient might type,
 * each carrying the destination that entry should open.
 *
 * Built on the server from the catalogue plus the live specialist roster, then
 * handed to the client as plain data so filtering is instant and needs no API
 * round-trip. Deliberately *not* a diagnosis engine — `reason` entries come from
 * the curated `visitReasons` routing table only.
 */
export type SearchEntryKind = 'doctor' | 'service' | 'department' | 'reason';

export type SearchEntry = {
  id: string;
  kind: SearchEntryKind;
  label: string;
  sublabel?: string;
  href: string;
  /** Lower-cased match terms; never rendered. */
  keywords: string[];
};

export const KIND_LABEL: Record<SearchEntryKind, string> = {
  doctor: 'Doctors',
  service: 'Services',
  department: 'Departments',
  reason: 'Reasons for visit',
};

/** Group order in the results list — most specific intent first. */
export const KIND_ORDER: SearchEntryKind[] = ['doctor', 'service', 'department', 'reason'];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function buildClinicSearchIndex({
  doctors,
  services = [],
  departments = [],
  locale = 'en',
}: {
  doctors: Practitioner[];
  services?: BookableService[];
  departments?: SearchDepartment[];
  locale?: Locale;
}): SearchEntry[] {
  const entries: SearchEntry[] = [];
  // Reasons deep-link into a service by slug, so only route the ones that
  // resolve — a reason pointing at a service the clinic no longer offers would
  // otherwise render a search result that 404s.
  const serviceSlugs = new Set(services.map((service) => service.slug));

  for (const doctor of doctors) {
    const name = `${doctor.title} ${doctor.firstName} ${doctor.lastName}`.trim();
    entries.push({
      id: `doctor:${doctor.id}`,
      kind: 'doctor',
      label: name,
      sublabel: doctor.specialty,
      href: `/doctors/${doctor.id}`,
      keywords: [normalize(name), normalize(doctor.specialty)].filter(Boolean),
    });
  }

  for (const service of services) {
    entries.push({
      id: `service:${service.slug}`,
      kind: 'service',
      label: locale === 'ar' ? (service.nameAr ?? service.name) : service.name,
      sublabel: `${service.durationMinutes} min`,
      href: `/services/${service.slug}`,
      keywords: [normalize(service.name), normalize(service.nameAr ?? ''), service.slug].filter(
        Boolean,
      ),
    });
  }

  for (const department of departments) {
    entries.push({
      id: `department:${department.slug}`,
      kind: 'department',
      label: locale === 'ar' ? department.nameAr : department.nameEn,
      href: `/departments/${department.slug}`,
      keywords: [normalize(department.nameEn), normalize(department.nameAr), department.slug],
    });
  }

  for (const reason of visitReasons) {
    if (!serviceSlugs.has(reason.serviceSlug)) continue;
    entries.push({
      id: `reason:${reason.slug}`,
      kind: 'reason',
      label: reason.label[locale],
      sublabel: 'Opens the matching consultation',
      href: `/book/service?service=${encodeURIComponent(reason.serviceSlug)}`,
      keywords: [
        normalize(reason.label.en),
        normalize(reason.label.ar),
        ...(reason.aliases ?? []).map(normalize),
      ],
    });
  }

  return entries;
}

/** Prefix-and-substring match, capped so the list stays scannable. */
export function searchClinicIndex(
  index: SearchEntry[],
  query: string,
  limit = 8,
): SearchEntry[] {
  const q = normalize(query);
  if (!q) return [];

  const scored: { entry: SearchEntry; score: number }[] = [];
  for (const entry of index) {
    let best = Infinity;
    for (const keyword of entry.keywords) {
      const at = keyword.indexOf(q);
      if (at === -1) continue;
      // Earlier matches rank higher; a word-start match beats a mid-word one.
      best = Math.min(best, at === 0 ? 0 : keyword[at - 1] === ' ' ? 1 : 2 + at);
    }
    if (best !== Infinity) scored.push({ entry, score: best });
  }

  scored.sort(
    (a, b) => a.score - b.score || KIND_ORDER.indexOf(a.entry.kind) - KIND_ORDER.indexOf(b.entry.kind),
  );
  return scored.slice(0, limit).map((s) => s.entry);
}
