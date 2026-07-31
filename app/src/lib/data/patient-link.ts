import { prisma } from '@/lib/db';
import { getDataProvider } from '@/lib/data';

/**
 * Slot-reservation key written to `BookingHold.activeSlotKey`.
 *
 * Normalised through Date so two spellings of the same instant can't both claim
 * a slot — the unique index only catches byte-identical strings.
 */
export function slotKey(practitionerId: string, startIso: string | Date): string {
  return `${practitionerId}|${new Date(startIso).toISOString()}`;
}

/**
 * Resolve a platform identity to a live EMR patient id, registering one if
 * needed.
 *
 * The mapping on PatientIdentity is a cache of an id the EMR owns, so it can go
 * stale in ways we don't control: a record merged into another, purged for a
 * data request, or — in mock mode — lost when the dev server restarts. Trusting
 * it blindly turns any of those into a permanent booking failure for that
 * patient, with no path back short of a manual DB edit.
 *
 * So the stored id is verified before use, and re-registered when it no longer
 * resolves. Callers get an id that was valid a moment ago rather than one that
 * merely used to be.
 */
export async function ensureEmrPatientId(
  identityId: string,
  fallbackName?: { firstName?: string; lastName?: string },
): Promise<string | null> {
  const identity = await prisma.patientIdentity.findUnique({ where: { id: identityId } });
  if (!identity) return null;

  const dp = getDataProvider();

  if (identity.openemrPatientUuid) {
    const known = await dp.getPatientById(identity.openemrPatientUuid).catch(() => null);
    if (known) return identity.openemrPatientUuid;
  }

  const firstName = fallbackName?.firstName ?? identity.firstName;
  const lastName = fallbackName?.lastName ?? identity.lastName;
  // Without a name there's nothing to register under; the caller should collect
  // one rather than have us invent a placeholder record in the EMR.
  if (!firstName || !lastName) return null;

  const created = await dp.createPatient({
    firstName,
    lastName,
    mobile: identity.mobile,
    sex: 'unknown',
  });

  await prisma.patientIdentity.update({
    where: { id: identity.id },
    data: { openemrPatientUuid: created.id, firstName, lastName },
  });

  return created.id;
}
