import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';
import { uniqueSlug } from '@/lib/slug';

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  nameAr: z.string().nullable().optional(),
  summaryEn: z.string().nullable().optional(),
  summaryAr: z.string().nullable().optional(),
  departmentId: z.string().min(1).nullable().optional(),
  durationMinutes: z.number().int().min(5).max(240).optional(),
  priceMinor: z.number().int().min(0).optional(),
  currency: z.string().optional(),
  active: z.boolean().optional(),
  showInServiceSearch: z.boolean().optional(),
  publishedOnWeb: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  /// Only sent when ops deliberately renames the public URL.
  regenerateSlug: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff(['admin']);
  const { id } = await params;

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { regenerateSlug, ...data } = parsed.data;

  // A rename does not move the URL by default — inbound links and any printed
  // material would break silently. Ops has to ask for it.
  let slug: string | undefined;
  if (regenerateSlug && data.name) {
    const others = await prisma.service.findMany({
      where: { NOT: { id } },
      select: { slug: true },
    });
    slug = uniqueSlug(data.name, others.map((s) => s.slug), 'service');
  }

  try {
    const updated = await prisma.service.update({
      where: { id },
      data: { ...data, ...(slug ? { slug } : {}) },
    });
    return NextResponse.json({ ok: true, service: updated });
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'slug_taken' }, { status: 409 });
    throw e;
  }
}

/**
 * Retire a service.
 *
 * `BookingHold.serviceId` carries no foreign key, so a hard delete would orphan
 * every booking that referenced it — and reschedule reads the service back for
 * its duration, so those bookings would stop being movable. Deactivating is
 * therefore the default and the only option once a booking exists; a service
 * nobody ever booked can be removed outright.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff(['admin']);
  const { id } = await params;

  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const bookings = await prisma.bookingHold.count({ where: { serviceId: id } });
  if (bookings > 0) {
    await prisma.service.update({
      where: { id },
      data: { active: false, showInServiceSearch: false, publishedOnWeb: false },
    });
    return NextResponse.json({ ok: true, deactivated: true, bookings });
  }

  await prisma.$transaction([
    prisma.serviceSpecialist.deleteMany({ where: { serviceId: id } }),
    prisma.service.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true, deleted: true });
}
