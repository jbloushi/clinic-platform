import { redirect } from 'next/navigation';
import { BookShell } from '@/components/domain/book-shell';
import { BookingSummary } from '@/components/domain/booking-summary';
import { prisma } from '@/lib/db';
import { DetailsForm } from './details-form';

export const dynamic = 'force-dynamic';

export default async function BookV2DetailsPage({
  searchParams,
}: {
  searchParams: Promise<{ holdId?: string; branch?: string }>;
}) {
  const { holdId, branch } = await searchParams;
  if (!holdId) redirect('/book/v2');

  const hold = await prisma.bookingHold.findUnique({ where: { id: holdId } });
  if (!hold) redirect('/book/v2');
  if (hold.status === 'confirmed') redirect(`/book/confirmed?id=${hold.id}`);
  if (hold.status !== 'held' && hold.status !== 'pending_payment') redirect('/book/v2');
  if (hold.holdExpiresAt < new Date()) redirect(`/book/v2?branch=${branch ?? ''}`);

  const settings = await prisma.assignmentSettings.findUnique({ where: { id: 'singleton' } });
  const revealDoctor = settings?.showDoctorNameBeforePayment ?? true;
  const showDoctor = revealDoctor || hold.assignmentMode !== 'AUTO';

  return (
    <BookShell backHref="/book/v2" backLabel="Start over" title="Your details">
      <BookingSummary
        doctorName={showDoctor ? hold.practitionerNameSnapshot ?? undefined : undefined}
        start={hold.startAt.toISOString()}
        branchName={hold.branchNameSnapshot ?? undefined}
        serviceName={hold.serviceNameSnapshot ?? undefined}
        className="mb-5"
      />
      <DetailsForm holdId={hold.id} branchSlug={branch} />
    </BookShell>
  );
}
