import { describe, expect, it } from 'vitest';
import {
  canSatisfySelectionMode,
  resolveEffectiveConfiguration,
  validateOffering,
  type OfferingValidationInput,
} from './offering-resolution';
import { normalizeSpecialty } from './specialty';

const SERVICE = { durationMinutes: 30, priceMinor: 2500 };

describe('resolveEffectiveConfiguration', () => {
  it('falls back to the service when nothing overrides it', () => {
    const result = resolveEffectiveConfiguration(SERVICE);
    expect(result).toMatchObject({
      durationMinutes: 30,
      priceMinor: 2500,
      durationSource: 'service',
      priceSource: 'service',
    });
  });

  it('lets a branch override the service', () => {
    const result = resolveEffectiveConfiguration(SERVICE, { durationMinutes: 45, priceMinor: 4000 });
    expect(result).toMatchObject({ durationMinutes: 45, priceMinor: 4000, priceSource: 'branch' });
  });

  it('lets an offering override the branch', () => {
    const result = resolveEffectiveConfiguration(
      SERVICE,
      { durationMinutes: 45, priceMinor: 4000 },
      { durationMinutes: 60, priceMinor: 6000 },
    );
    expect(result).toMatchObject({
      durationMinutes: 60,
      priceMinor: 6000,
      durationSource: 'offering',
      priceSource: 'offering',
    });
  });

  it('resolves duration and price independently', () => {
    // A branch that charges more but takes the same time overrides only price.
    const result = resolveEffectiveConfiguration(SERVICE, { durationMinutes: null, priceMinor: 4000 });
    expect(result).toMatchObject({
      durationMinutes: 30,
      durationSource: 'service',
      priceMinor: 4000,
      priceSource: 'branch',
    });
  });

  it('treats a zero override as a real value, not as absent', () => {
    // A free follow-up is priced 0; falling through to the service fee here
    // would silently charge the patient.
    const result = resolveEffectiveConfiguration(SERVICE, { durationMinutes: null, priceMinor: 0 });
    expect(result.priceMinor).toBe(0);
    expect(result.priceSource).toBe('branch');
  });
});

describe('validateOffering', () => {
  const valid: OfferingValidationInput = {
    practitionerActiveInEmr: true,
    practitionerAssignedToBranch: true,
    serviceActiveAtBranch: true,
    serviceInDepartment: true,
    branchOperational: true,
    serviceOperational: true,
    departmentOperational: true,
    offeringActive: true,
  };

  it('passes when every parent relationship holds', () => {
    expect(validateOffering(valid)).toEqual([]);
  });

  it('reports a doctor who is not assigned to the branch', () => {
    expect(validateOffering({ ...valid, practitionerAssignedToBranch: false })).toEqual([
      'practitioner_not_at_branch',
    ]);
  });

  it('reports every failure at once rather than stopping at the first', () => {
    const failures = validateOffering({
      ...valid,
      practitionerActiveInEmr: false,
      serviceActiveAtBranch: false,
      offeringActive: false,
    });
    expect(failures).toEqual(['practitioner_inactive', 'service_not_at_branch', 'offering_inactive']);
  });
});

describe('canSatisfySelectionMode', () => {
  const auto = { allowAutoAssignment: true, allowPatientChoice: false };
  const choice = { allowAutoAssignment: false, allowPatientChoice: true };

  it('fails AUTO when no offering allows automatic assignment', () => {
    expect(canSatisfySelectionMode('AUTO', [choice])).toBe(false);
    expect(canSatisfySelectionMode('AUTO', [auto])).toBe(true);
  });

  it('fails PATIENT_CHOICE when no offering is patient-selectable', () => {
    expect(canSatisfySelectionMode('PATIENT_CHOICE', [auto])).toBe(false);
    expect(canSatisfySelectionMode('PATIENT_CHOICE', [choice])).toBe(true);
  });

  it('accepts either capability for the combined mode', () => {
    expect(canSatisfySelectionMode('AUTO_OR_PATIENT_CHOICE', [auto])).toBe(true);
    expect(canSatisfySelectionMode('AUTO_OR_PATIENT_CHOICE', [choice])).toBe(true);
  });

  it('fails every public mode when there are no offerings at all', () => {
    expect(canSatisfySelectionMode('AUTO', [])).toBe(false);
    expect(canSatisfySelectionMode('PATIENT_CHOICE', [])).toBe(false);
    expect(canSatisfySelectionMode('AUTO_OR_PATIENT_CHOICE', [])).toBe(false);
  });

  it('always satisfies OPS_ONLY, which is never publicly bookable', () => {
    expect(canSatisfySelectionMode('OPS_ONLY', [])).toBe(true);
  });
});

describe('normalizeSpecialty', () => {
  it('folds case, separators and repeated whitespace to one key', () => {
    const expected = 'ear nose throat';
    for (const variant of ['Ear Nose Throat', 'ear-nose-throat', 'EAR_NOSE_THROAT', '  Ear  Nose   Throat  ']) {
      expect(normalizeSpecialty(variant)).toBe(expected);
    }
  });

  it('is idempotent, so re-normalising a stored key is safe', () => {
    const once = normalizeSpecialty('Gastroenterology, Endoscopy & Liver');
    expect(normalizeSpecialty(once)).toBe(once);
  });

  it('keeps distinct specialties distinct', () => {
    expect(normalizeSpecialty('Cardiology')).not.toBe(normalizeSpecialty('Dermatology'));
  });

  it('applies NFKC so full-width input matches its ASCII form', () => {
    expect(normalizeSpecialty('Ｃardiology')).toBe('cardiology');
  });
});
