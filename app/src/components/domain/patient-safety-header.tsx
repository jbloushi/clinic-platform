import { AlertTriangle, Pill } from 'lucide-react';
import { DoctorAvatar } from './avatar';
import { cn, ageFrom, formatPrice, formatTime, maskIdentifier } from '@/lib/utils';
import type { MedicalHistory, Patient } from '@/lib/data/types';

const SEX_LABEL: Record<NonNullable<Patient['sex']>, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  unknown: 'Not recorded',
};

/**
 * Persistent patient context for the consultation workspace.
 *
 * Stays fixed at the top of the encounter so the clinician never loses track of
 * who they're documenting. Two bands: identity and appointment context, then a
 * clinical-alert strip that only appears when there is something to warn about.
 *
 * Wallet balance is gated behind `canSeeWallet` — it's billing data, not
 * clinical, so it renders only for roles authorised to see it. Civil ID is
 * always masked.
 */
export function PatientSafetyHeader({
  patient,
  history,
  appointmentStart,
  visitType,
  walletBalanceMinor,
  canSeeWallet = false,
  currency = 'KWD',
  action,
  className,
}: {
  patient: Patient | null;
  history?: Pick<MedicalHistory, 'allergies' | 'medications'>;
  appointmentStart?: string;
  /** e.g. "Obesity consult" — the reason/service for this encounter. */
  visitType?: string;
  walletBalanceMinor?: number;
  canSeeWallet?: boolean;
  currency?: string;
  /** "Finish & sign" — owned by the workspace so it can validate first. */
  action?: React.ReactNode;
  className?: string;
}) {
  const name = patient ? `${patient.firstName} ${patient.lastName}`.trim() : 'Patient';
  const age = ageFrom(patient?.dateOfBirth);

  const identity = [
    patient?.sex ? SEX_LABEL[patient.sex] : null,
    age !== null ? `${age}` : null,
    patient ? `Civil ID ${maskIdentifier(patient.openemrPid ?? patient.id)}` : null,
    canSeeWallet && walletBalanceMinor !== undefined
      ? `Wallet ${formatPrice(walletBalanceMinor, currency)}`
      : null,
  ].filter(Boolean);

  const allergies = history?.allergies ?? [];
  const activeMeds = (history?.medications ?? []).filter((m) => m.active);

  return (
    <header className={cn('border-b bg-surface', className)}>
      <div className="flex flex-wrap items-center gap-4 px-5 py-4 md:px-6">
        <DoctorAvatar name={name} specialty={patient?.sex ?? name} size={52} />

        <div className="min-w-0 flex-1">
          <h2 className="truncate font-editorial text-[19px] font-semibold leading-tight">{name}</h2>
          {identity.length > 0 && (
            <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
              {identity.join(' · ')}
            </p>
          )}
        </div>

        {(appointmentStart || visitType) && (
          <div className="text-end">
            <p className="text-[11px] text-muted-foreground">Appointment</p>
            <p className="text-[13.5px] font-semibold text-primary">
              {[appointmentStart ? formatTime(appointmentStart) : null, visitType]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        )}

        {action && <div className="shrink-0">{action}</div>}
      </div>

      {(allergies.length > 0 || activeMeds.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-muted px-5 pb-3 pt-2.5 md:px-6">
          {allergies.length > 0 && (
            <p className="inline-flex items-center gap-1.5 rounded-full border border-[#EBCFCB] bg-[#F7E5E3] px-2.5 py-1 text-[11.5px] font-semibold text-[#8A2E24]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="sr-only">Allergy alert: </span>
              Allergies: {allergies.map((a) => a.substance).join(', ')}
            </p>
          )}
          {activeMeds.length > 0 && (
            <p className="inline-flex items-center gap-1.5 rounded-full border border-tint-teal-border bg-tint-teal px-2.5 py-1 text-[11.5px] font-semibold text-primary">
              <Pill className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {activeMeds.length} active medication{activeMeds.length === 1 ? '' : 's'}
            </p>
          )}
        </div>
      )}
    </header>
  );
}
