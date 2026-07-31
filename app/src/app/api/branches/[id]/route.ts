import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';
import { uniqueSlug } from '@/lib/slug';

const patchSchema = z.object({
  nameEn: z.string().min(1).optional(),
  nameAr: z.string().min(1).optional(),
  areaEn: z.string().min(1).optional(),
  areaAr: z.string().min(1).optional(),
  addressLine: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  mapUrl: z.string().nullable().optional(),
  openemrFacilityId: z.number().int().nullable().optional(),
  published: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  regenerateSlug: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff(['admin']);
  const { id } = await params;

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const existing = await prisma.branch.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { regenerateSlug, ...data } = parsed.data;

  // A published branch must resolve to a real OpenEMR facility, or bookings
  // there would silently land at the env default facility — the wrong clinic.
  const facilityAfter =
    data.openemrFacilityId !== undefined ? data.openemrFacilityId : existing.openemrFacilityId;
  const publishedAfter = data.published ?? existing.published;
  if (publishedAfter && facilityAfter == null) {
    return NextResponse.json({ error: 'facility_required_to_publish' }, { status: 400 });
  }

  let slug: string | undefined;
  if (regenerateSlug && data.nameEn) {
    const others = await prisma.branch.findMany({ where: { NOT: { id } }, select: { slug: true } });
    slug = uniqueSlug(data.nameEn, others.map((b) => b.slug), 'branch');
  }

  try {
    const updated = await prisma.branch.update({
      where: { id },
      data: { ...data, ...(slug ? { slug } : {}) },
    });
    return NextResponse.json({ ok: true, branch: updated });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'slug_or_facility_taken' }, { status: 409 });
    }
    throw e;
  }
}

/**
 * Delete a branch.
 *
 * Blocked while any booking references it: `BookingHold.branchId` is
 * `onDelete: Restrict`, and a past visit's location is a fact about that visit,
 * not something to erase. The OpenEMR facility is never touched — unlinking is
 * this app's business; removing a clinic location is OpenEMR's.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff(['admin']);
  const { id } = await params;

  const existing = await prisma.branch.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const bookings = await prisma.bookingHold.count({ where: { branchId: id } });
  if (bookings > 0) {
    return NextResponse.json({ error: 'has_bookings', bookings }, { status: 409 });
  }

  // PractitionerBranch cascades; services fall back to no branch.
  await prisma.branch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
