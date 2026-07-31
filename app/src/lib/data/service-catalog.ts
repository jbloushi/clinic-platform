import { prisma } from '@/lib/db';

/**
 * The services catalogue.
 *
 * There used to be two: a hardcoded bilingual list for the marketing pages and
 * the `Service` rows that bookings actually referenced. They shared no keys, so
 * a department filter returned nothing in production and a public service link
 * only resolved in mock mode. This is now the single source for both.
 *
 * Deliberately NOT switched by `USE_MOCK_DATA`. That flag means "clinical
 * entities are synthetic" — patients, practitioners, appointments, the things
 * OpenEMR owns. Services, departments and branches are platform data and come
 * from Prisma in every mode, so there is one catalogue to maintain and no
 * second copy to drift.
 */

export type BookableService = {
  id: string;
  slug: string;
  name: string;
  nameAr: string | null;
  summaryEn: string | null;
  summaryAr: string | null;
  durationMinutes: number;
  priceMinor: number;
  currency: string;
  active: boolean;
  showInServiceSearch: boolean;
  publishedOnWeb: boolean;
  departmentId: string | null;
  departmentSlug?: string;
  sortOrder: number;
};

const SELECT = {
  id: true,
  slug: true,
  name: true,
  nameAr: true,
  summaryEn: true,
  summaryAr: true,
  durationMinutes: true,
  priceMinor: true,
  currency: true,
  active: true,
  showInServiceSearch: true,
  publishedOnWeb: true,
  departmentId: true,
  sortOrder: true,
  department: { select: { slug: true } },
} as const;

type Row = {
  department: { slug: string } | null;
} & Omit<BookableService, 'departmentSlug'>;

function toBookable(row: Row): BookableService {
  const { department, ...rest } = row;
  return { ...rest, departmentSlug: department?.slug };
}

export async function listBookableServices(
  options: { onlineOnly?: boolean; publishedOnWeb?: boolean; departmentSlug?: string } = {},
): Promise<BookableService[]> {
  const rows = await prisma.service.findMany({
    where: {
      active: true,
      ...(options.onlineOnly ? { showInServiceSearch: true } : {}),
      ...(options.publishedOnWeb ? { publishedOnWeb: true } : {}),
      ...(options.departmentSlug ? { department: { slug: options.departmentSlug } } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: SELECT,
  });
  return rows.map(toBookable);
}

/**
 * Look a service up by id or slug.
 *
 * Both are accepted because bookings created before the catalogues merged
 * stored the slug in `serviceId` (mock mode had `id === slug`). Resolving only
 * by id would strand every one of those: the appointments page would lose the
 * service name and reschedule would lose the duration it needs.
 */
export async function getBookableService(idOrSlug: string): Promise<BookableService | null> {
  const row = await prisma.service.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: SELECT,
  });
  return row ? toBookable(row) : null;
}

export async function getServiceSpecialistIds(serviceId: string): Promise<string[]> {
  const rows = await prisma.serviceSpecialist.findMany({
    where: { serviceId },
    select: { specialistOpenemrUuid: true },
  });
  return rows.map((row) => row.specialistOpenemrUuid);
}

/**
 * Services this specialist may perform.
 *
 * A service with no rows in `ServiceSpecialist` at all is unrestricted; once it
 * has any, only the listed specialists are eligible. That fallback is what lets
 * booking work before ops has configured eligibility for everything.
 */
export async function getEligibleServicesForSpecialist(
  specialistId: string,
): Promise<BookableService[]> {
  const [services, links] = await Promise.all([
    listBookableServices(),
    prisma.serviceSpecialist.findMany({
      select: { serviceId: true, specialistOpenemrUuid: true },
    }),
  ]);

  const restricted = new Set(links.map((link) => link.serviceId));
  const linked = new Set(
    links.filter((link) => link.specialistOpenemrUuid === specialistId).map((link) => link.serviceId),
  );
  return services.filter((service) => !restricted.has(service.id) || linked.has(service.id));
}
