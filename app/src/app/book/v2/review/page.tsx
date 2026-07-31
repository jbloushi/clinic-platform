import { redirect } from 'next/navigation';
import { BookShell } from '@/components/domain/book-shell';
import { BookingSummary } from '@/components/domain/booking-summary';
import { CheckoutSummary } from '@/components/domain/checkout-summary';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { ReviewActions } from './review-actions';

export const dynamic = 'force-dynamic';

export default async function BookV2ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ holdId?: string; branch?: string }>;
}) {
  const { holdId, branch } = await searchParams;
  if (!holdId) redirect('/book/v2');

  const session = await getSession();
  const hold = await prisma.bookingHold.findUnique({ where: { id: holdId } });
  if (!hold) redirect('/book/v2');
  if (hold.status === 'confirmed') redirect(`/book/confirmed?id=${hold.id}`);
  if (!hold.patientIdentityId || hold.patientIdentityId !== session.patient?.id) {
    // Identity isn't attached yet (or belongs to someone else) — send back
    // through the details step rather than exposing this hold.
    const query = new URLSearchParams({ holdId: hold.id });
    if (branch) query.set('branch', branch);
    redirect(`/book/v2/details?${query}`);
  }
  if (hold.status !== 'held' && hold.status !== 'pending_payment' && hold.status !== 'finalization_failed') {
    redirect('/book/v2');
  }
  if (hold.holdExpiresAt < new Date() && hold.status !== 'finalization_failed') {
    redirect(`/book/v2?branch=${branch ?? ''}`);
  }

  const settings = await prisma.assignmentSettings.findUnique({ where: { id: 'singleton' } });
  const revealDoctor = settings?.showDoctorNameBeforePayment ?? true;
  const showDoctor = revealDoctor || hold.assignmentMode !== 'AUTO';
  const feeMinor = hold.servicePriceSnapshot ?? 0;

  return (
    <BookShell backHref={`/book/v2/details?holdId=${hold.id}`} backLabel="Back" title="Review & pay">
      <BookingSummary
        doctorName={showDoctor ? hold.practitionerNameSnapshot ?? undefined : undefined}
        start={hold.startAt.toISOString()}
        branchName={hold.branchNameSnapshot ?? undefined}
        serviceName={hold.serviceNameSnapshot ?? undefined}
        className="mb-5"
      />
      <CheckoutSummary
        lines={[{ label: hold.serviceNameSnapshot ?? 'Consultation', amountMinor: feeMinor }]}
        totalMinor={feeMinor}
        className="mb-5"
      />
      <ReviewActions holdId={hold.id} feeMinor={feeMinor} retry={hold.status === 'finalization_failed'} />
    </BookShell>
  );
}
