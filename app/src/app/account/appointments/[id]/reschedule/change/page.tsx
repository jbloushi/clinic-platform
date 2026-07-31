import { notFound, redirect } from 'next/navigation';
import { BookShell } from '@/components/domain/book-shell';
import { prisma } from '@/lib/db';
import { requirePatient } from '@/lib/auth/guards';
import { listBranches } from '@/lib/data/reference-repo';
import { ChangeFlow } from './change-flow';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Change doctor, service or branch' };

const CHANGEABLE = new Set(['held', 'pending_payment', 'confirmed']);

/**
 * The flexible counterpart to the same-doctor `../page.tsx` reschedule —
 * branch, service, and doctor may all change here. Routes through
 * `POST /api/booking-holds/[id]/reschedule` (`reschedule.ts`), not the old
 * same-doctor-only `PATCH /api/bookings/[id]`.
 */
export default async function ChangeReschedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await requirePatient();

  const booking = await prisma.bookingHold.findFirst({
    where: { id, patientIdentityId: patient.id },
  });
  if (!booking) notFound();
  if (!CHANGEABLE.has(booking.status) || booking.startAt.getTime() <= Date.now()) {
    redirect('/account/appointments');
  }

  const branches = await listBranches({ publishedOnly: true });

  return (
    <BookShell
      backHref={`/account/appointments/${id}/reschedule`}
      backLabel="Back"
      title="Change doctor, service, or branch"
      description="Picking a new time here can also move the visit — the original is only released once the new one is confirmed."
    >
      <ChangeFlow
        bookingId={booking.id}
        currentBranchId={booking.branchId}
        currentServiceId={booking.serviceId}
        currentPractitionerId={booking.practitionerOpenemrId}
        currentServiceName={booking.serviceNameSnapshot}
        currentPractitionerName={booking.practitionerNameSnapshot}
        currentBranchName={booking.branchNameSnapshot}
        branches={branches.map((b) => ({ id: b.id, name: b.nameEn }))}
      />
    </BookShell>
  );
}
