import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';
import { getDataProvider } from '@/lib/data';
import { getWalletBalance } from '@/lib/data/platform-repo';
import type { MedicalHistory } from '@/lib/data/types';
import { ConsultWorkspace } from './workspace';

export const dynamic = 'force-dynamic';

const EMPTY_HISTORY: MedicalHistory = {
  problems: [],
  allergies: [],
  medications: [],
  vitals: [],
  documents: [],
};

export default async function ConsultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ patient?: string }>;
}) {
  const staff = await requireStaff(['doctor', 'admin']);
  const { id } = await params;
  const { patient: patientParam } = await searchParams;

  const dp = getDataProvider();
  const appointment = await dp.getAppointmentById(id);
  if (!appointment) notFound();

  const patientId = patientParam ?? appointment.patientId;
  const [patient, history] = await Promise.all([
    dp.getPatientById(patientId),
    dp.getPatientMedicalHistory(patientId).catch(() => EMPTY_HISTORY),
  ]);

  // The platform-side booking behind this appointment, so a follow-up requested
  // during the consult can be linked to the visit that prompted it. Absent for
  // walk-ins booked straight into OpenEMR, which simply means no link to make.
  const originBooking = await prisma.bookingHold
    .findFirst({ where: { openemrAppointmentId: appointment.id }, select: { id: true } })
    .catch(() => null);

  // Wallet balance is billing data, not clinical. Only look it up for roles
  // authorised to see it, so it can't leak through props to the client.
  const canSeeWallet = staff.role === 'admin';
  let walletBalanceMinor: number | undefined;
  if (canSeeWallet) {
    const identity = await prisma.patientIdentity.findUnique({
      where: { openemrPatientUuid: patientId },
      select: { id: true },
    });
    walletBalanceMinor = identity ? await getWalletBalance(identity.id).catch(() => undefined) : undefined;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b bg-surface-soft px-5 py-2 md:px-6">
        <Link
          href="/doctor/schedule"
          className="inline-flex min-h-[36px] items-center gap-1.5 text-[12.5px] font-semibold text-primary hover:underline"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          Back to schedule
        </Link>
      </div>

      <ConsultWorkspace
        appointment={appointment}
        patient={patient}
        history={history}
        walletBalanceMinor={walletBalanceMinor}
        canSeeWallet={canSeeWallet}
        originBookingId={originBooking?.id}
      />
    </div>
  );
}
