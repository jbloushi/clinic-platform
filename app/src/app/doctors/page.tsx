import { PatientShell } from '@/components/domain/patient-shell';
import { ErrorState } from '@/components/domain/states';
import { getDataProvider } from '@/lib/data';
import { getNextAvailableMap } from '@/lib/data/availability-hints';
import { getBranchBySlug, getDepartmentBySlug, restrictToBranch, specialtyKey } from '@/lib/data/reference-repo';
import { getLocale } from '@/lib/i18n-server';
import type { Practitioner } from '@/lib/data/types';
import { SpecialistBrowser } from './specialist-browser';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Find a doctor' };

export default async function FindDoctorPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; department?: string; specialty?: string }>;
}) {
  const { branch, department, specialty } = await searchParams;
  const dp = getDataProvider();

  const selectedBranch = branch ? await getBranchBySlug(branch) : null;

  let specialists: Practitioner[] = [];
  let error: string | null = null;
  try {
    specialists = await restrictToBranch(
      await dp.getPractitioners({ activeOnly: true }),
      selectedBranch?.id,
    );
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : 'Could not load specialists';
  }

  // A department is a set of OpenEMR specialty values, not a single one. Links
  // used to pass a department's display name as `?specialty=` into an
  // exact-match filter, which could never match the free-text specialty on a
  // real practitioner — the list was always empty in production.
  const dept = department ? await getDepartmentBySlug(department) : null;
  const initialSpecialties = dept
    ? dept.specialties.map((s) => s.specialty)
    : specialty
      ? // A bare ?specialty= still works, matched case-insensitively against the
        // live roster so an exact-case link isn't required.
        specialists
          .map((s) => s.specialty)
          .filter((value) => specialtyKey(value) === specialtyKey(specialty))
      : [];

  const [locale, nextAvailable] = await Promise.all([
    getLocale(),
    getNextAvailableMap(dp, specialists),
  ]);

  const heading = dept ? (locale === 'ar' ? dept.nameAr : dept.nameEn) : 'Find a doctor';

  return (
    <PatientShell>
      <div className="px-5 pb-8 md:px-8">
        <div className="mx-auto max-w-4xl pb-4 pt-5">
          <h1 className="font-editorial text-[22px] font-semibold md:text-[26px]">{heading}</h1>
          {dept && (
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              {locale === 'ar' ? dept.summaryAr : dept.summaryEn}
            </p>
          )}
        </div>

        {error ? (
          <div className="mx-auto max-w-4xl rounded-card border bg-surface">
            <ErrorState description={error} />
          </div>
        ) : (
          <SpecialistBrowser
            specialists={specialists}
            nextAvailable={nextAvailable}
            branchSlug={branch}
            initialSpecialties={initialSpecialties}
          />
        )}
      </div>
    </PatientShell>
  );
}
