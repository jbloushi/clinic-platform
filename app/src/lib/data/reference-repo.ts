import { prisma } from '@/lib/db';
import { branchFilteringEnabled } from '@/lib/env';
import type { Practitioner } from './types';

/**
 * Clinic reference data — departments, branches, and the joins that tie them to
 * OpenEMR.
 *
 * OpenEMR owns the clinical entities: practitioners and their free-text
 * specialty, and facilities. What it has no field for — bilingual names,
 * marketing summaries, publishing state, display order, and the notion of a
 * "department" at all — lives here and points at those entities by id or by
 * specialty string. This module is the seam between the two.
 */

export type LocalizedRef = { en: string; ar: string };

/** Trim + lowercase, so specialty matching never depends on DB collation. */
export function specialtyKey(value: string): string {
  return value.trim().toLowerCase();
}

// ---------- Departments ----------

export function listDepartments(opts: { publishedOnly?: boolean } = {}) {
  return prisma.department.findMany({
    where: opts.publishedOnly ? { published: true } : undefined,
    orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    include: { specialties: true },
  });
}

export function getDepartmentBySlug(slug: string) {
  return prisma.department.findUnique({ where: { slug }, include: { specialties: true } });
}

/** The OpenEMR specialty strings that belong to a department, lowercased. */
export async function getDepartmentSpecialtyKeys(departmentId: string): Promise<string[]> {
  const rows = await prisma.departmentSpecialty.findMany({
    where: { departmentId },
    select: { specialtyKey: true },
  });
  return rows.map((r) => r.specialtyKey);
}

/** Atomically replace a department's whole specialty set. */
export async function setDepartmentSpecialties(
  departmentId: string,
  specialties: string[],
): Promise<void> {
  // Dedupe on the key so "Cardiology" and "cardiology" can't both be stored —
  // the unique index would reject the second and fail the whole replace.
  const byKey = new Map<string, string>();
  for (const specialty of specialties) {
    const trimmed = specialty.trim();
    if (trimmed) byKey.set(specialtyKey(trimmed), trimmed);
  }

  await prisma.$transaction([
    prisma.departmentSpecialty.deleteMany({ where: { departmentId } }),
    prisma.departmentSpecialty.createMany({
      data: Array.from(byKey, ([key, specialty]) => ({
        departmentId,
        specialty,
        specialtyKey: key,
      })),
    }),
  ]);
}

/**
 * Keep only the practitioners whose specialty belongs to a department.
 *
 * Pure and in-memory: `GET /practitioner` returns the whole roster unfiltered
 * anyway, so partitioning here costs nothing and works identically in mock mode.
 * An empty `keys` means the department has no mapping yet — that yields no
 * doctors, which is the honest answer rather than silently showing everyone.
 */
export function filterPractitionersBySpecialtyKeys(
  practitioners: Practitioner[],
  keys: string[],
): Practitioner[] {
  const wanted = new Set(keys);
  return practitioners.filter((p) => wanted.has(specialtyKey(p.specialty)));
}

// ---------- Branches ----------

export function listBranches(opts: { publishedOnly?: boolean } = {}) {
  return prisma.branch.findMany({
    where: opts.publishedOnly ? { published: true } : undefined,
    orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
  });
}

export function getBranchBySlug(slug: string) {
  return prisma.branch.findUnique({ where: { slug } });
}

export function getBranchById(id: string) {
  return prisma.branch.findUnique({ where: { id } });
}

/**
 * Practitioner UUIDs explicitly assigned to a branch.
 *
 * An empty result means "nobody is restricted to this branch", NOT "nobody
 * works here" — see `filterPractitionersByBranch` for how that's applied.
 */
export async function getPractitionerUuidsForBranch(branchId: string): Promise<string[]> {
  const rows = await prisma.practitionerBranch.findMany({
    where: { branchId },
    select: { specialistOpenemrUuid: true },
  });
  return rows.map((r) => r.specialistOpenemrUuid);
}

/** Every practitioner→branch link, for filtering a roster in one pass. */
export async function getAllPractitionerBranchLinks(): Promise<Map<string, Set<string>>> {
  const rows = await prisma.practitionerBranch.findMany({
    select: { specialistOpenemrUuid: true, branchId: true },
  });
  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = map.get(row.specialistOpenemrUuid) ?? new Set<string>();
    set.add(row.branchId);
    map.set(row.specialistOpenemrUuid, set);
  }
  return map;
}

/** Atomically replace the set of practitioners assigned to a branch. */
export async function setBranchPractitioners(branchId: string, uuids: string[]): Promise<void> {
  const unique = Array.from(new Set(uuids.filter(Boolean)));
  await prisma.$transaction([
    prisma.practitionerBranch.deleteMany({ where: { branchId } }),
    prisma.practitionerBranch.createMany({
      data: unique.map((specialistOpenemrUuid) => ({ branchId, specialistOpenemrUuid })),
    }),
  ]);
}

/** Atomically replace the set of branches a practitioner works at. */
export async function setPractitionerBranches(uuid: string, branchIds: string[]): Promise<void> {
  const unique = Array.from(new Set(branchIds.filter(Boolean)));
  await prisma.$transaction([
    prisma.practitionerBranch.deleteMany({ where: { specialistOpenemrUuid: uuid } }),
    prisma.practitionerBranch.createMany({
      data: unique.map((branchId) => ({ branchId, specialistOpenemrUuid: uuid })),
    }),
  ]);
}

/**
 * Keep only the practitioners who work at a branch.
 *
 * A practitioner with NO links at all works everywhere. Without that
 * convention, turning branch filtering on would empty every doctor list until
 * ops had assigned each one individually — a silent, total outage of the
 * booking flow. Once a practitioner has any link, they appear only at the
 * branches they're linked to.
 */
export function filterPractitionersByBranch(
  practitioners: Practitioner[],
  branchId: string,
  links: Map<string, Set<string>>,
): Practitioner[] {
  return practitioners.filter((p) => {
    const assigned = links.get(p.id);
    if (!assigned || assigned.size === 0) return true;
    return assigned.has(branchId);
  });
}

/**
 * Narrow a roster to a branch, if branch filtering is switched on.
 *
 * The single entry point every read path uses, so the flag can't end up applied
 * in one place and not another — a half-applied filter would let a patient pick
 * a doctor the booking route then rejects.
 */
export async function restrictToBranch(
  practitioners: Practitioner[],
  branchId: string | null | undefined,
): Promise<Practitioner[]> {
  if (!branchFilteringEnabled || !branchId) return practitioners;
  const links = await getAllPractitionerBranchLinks();
  return filterPractitionersByBranch(practitioners, branchId, links);
}
