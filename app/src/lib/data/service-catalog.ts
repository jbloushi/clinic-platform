import { useMock } from '@/lib/env';
import { services as publicServices } from '@/lib/clinic-catalog';
import { prisma } from '@/lib/db';

export type BookableService = {
  id: string;
  name: string;
  durationMinutes: number;
  priceMinor: number;
  currency: string;
  active: boolean;
  showInServiceSearch: boolean;
  departmentSlug?: string;
};

const mockServices: BookableService[] = publicServices.map((service) => ({
  id: service.slug,
  name: service.name.en,
  durationMinutes: service.durationMinutes ?? 30,
  priceMinor: 2500,
  currency: 'KWD',
  active: true,
  showInServiceSearch: true,
  departmentSlug: service.departmentSlug,
}));

export async function listBookableServices(options: { onlineOnly?: boolean } = {}): Promise<BookableService[]> {
  if (useMock) {
    return mockServices.filter((service) => !options.onlineOnly || service.showInServiceSearch);
  }
  return prisma.service.findMany({
    where: { active: true, ...(options.onlineOnly ? { showInServiceSearch: true } : {}) },
    orderBy: { name: 'asc' },
  });
}

export async function getBookableService(id: string): Promise<BookableService | null> {
  if (useMock) return mockServices.find((service) => service.id === id) ?? null;
  return prisma.service.findUnique({ where: { id } });
}

export async function getServiceSpecialistIds(serviceId: string): Promise<string[]> {
  if (useMock) return [];
  const rows = await prisma.serviceSpecialist.findMany({
    where: { serviceId },
    select: { specialistOpenemrUuid: true },
  });
  return rows.map((row) => row.specialistOpenemrUuid);
}

export async function getEligibleServicesForSpecialist(specialistId: string): Promise<BookableService[]> {
  const services = await listBookableServices();
  if (useMock) return services;
  const links = await prisma.serviceSpecialist.findMany({
    select: { serviceId: true, specialistOpenemrUuid: true },
  });
  const restricted = new Set(links.map((link) => link.serviceId));
  const linked = new Set(
    links.filter((link) => link.specialistOpenemrUuid === specialistId).map((link) => link.serviceId),
  );
  return services.filter((service) => !restricted.has(service.id) || linked.has(service.id));
}
