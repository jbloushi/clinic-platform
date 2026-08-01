import Link from 'next/link';
import { ArrowRight, Building2, CalendarCheck, LifeBuoy, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BranchSelector } from '@/components/domain/branch-selector';
import { DepartmentTile } from '@/components/domain/department-tile';
import { DoctorCard } from '@/components/domain/doctor-card';
import { UnifiedClinicSearch } from '@/components/domain/clinic-search';
import { PatientShell } from '@/components/domain/patient-shell';
import { ErrorState } from '@/components/domain/states';
import { getDataProvider } from '@/lib/data';
import { bySoonestAvailable, getNextAvailableMap } from '@/lib/data/availability-hints';
import { buildClinicSearchIndex } from '@/lib/search/clinic-search-index';
import { listBranches, listDepartments } from '@/lib/data/reference-repo';
import { listBookableServices } from '@/lib/data/service-catalog';
import { getLocale } from '@/lib/i18n-server';
import type { Practitioner } from '@/lib/data/types';

export const dynamic = 'force-dynamic';

/** How many specialists the "earliest available" block shows. */
const FEATURED_COUNT = 3;

export default async function HomePage() {
  const locale = await getLocale();
  const dp = getDataProvider();

  let specialists: Practitioner[] = [];
  let rosterError: string | null = null;
  try {
    specialists = await dp.getPractitioners({ activeOnly: true });
  } catch (error: unknown) {
    rosterError = error instanceof Error ? error.message : 'Could not load the specialist roster';
  }

  const [nextAvailable, branches, departments, services] = await Promise.all([
    getNextAvailableMap(dp, specialists),
    listBranches({ publishedOnly: true }),
    listDepartments({ publishedOnly: true }),
    listBookableServices({ publishedOnWeb: true }),
  ]);
  const soonest = [...specialists].sort(bySoonestAvailable(nextAvailable)).slice(0, FEATURED_COUNT);
  const searchIndex = buildClinicSearchIndex({
    doctors: specialists,
    services,
    departments,
    locale,
  });

  return (
    <PatientShell>
      <section className="brand-gradient px-5 pb-7 pt-6 text-surface-soft md:px-8 md:pb-12 md:pt-10">
          <div className="mx-auto max-w-6xl">
            {/* Identity and the language control live in the header at every
                width now, so the hero no longer repeats them on mobile. */}
            <div className="md:grid md:grid-cols-[1.05fr_.95fr] md:items-end md:gap-12">
              <div>
                <h1 className="max-w-[18ch] font-editorial text-[27px] font-semibold leading-[1.12] md:text-[44px]">
                  Care you can trust, close to home.
                </h1>
                <p className="mt-1.5 max-w-[46ch] text-[13.5px] leading-relaxed text-surface-soft/80 md:text-[16px]">
                  Book with the right specialist in under a minute.
                </p>

                <div className="mt-[18px]">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-surface-soft/65">
                    Choose a branch
                  </p>
                  <BranchSelector
                    variant="on-brand"
                    branches={branches.map((branch) => ({
                      slug: branch.slug,
                      label: locale === 'ar' ? branch.nameAr : branch.nameEn,
                      href: `/book/v2?branch=${branch.slug}`,
                    }))}
                  />
                </div>
              </div>

              <ul className="mt-7 hidden gap-x-6 gap-y-2 text-[14px] text-surface-soft/80 md:flex md:flex-wrap">
                <li className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-accent" aria-hidden />
                  Confidential medical care
                </li>
                <li className="inline-flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-accent" aria-hidden />
                  Hawally and Jahra
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Search sits across the hero edge, as in the approved design. */}
        <div className="relative z-20 -mt-5 px-5 md:px-8">
          <div className="mx-auto max-w-6xl md:max-w-2xl">
            <UnifiedClinicSearch index={searchIndex} />
          </div>
        </div>

        <div className="mx-auto max-w-6xl space-y-9 px-5 pb-10 pt-7 md:px-8 md:pb-16 md:pt-10">
          <section>
            <SectionHeading title="Departments" href="/departments" linkLabel="See all" />
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              {departments.map((department) => (
                <DepartmentTile
                  key={department.id}
                  slug={department.slug}
                  name={locale === 'ar' ? department.nameAr : department.nameEn}
                  summary={locale === 'ar' ? department.summaryAr : department.summaryEn}
                />
              ))}
            </div>
          </section>

          <section>
            <SectionHeading
              title="Earliest appointments"
              href="/doctors"
              linkLabel="All specialists"
            />
            {rosterError ? (
              <div className="rounded-card border bg-surface">
                <ErrorState description={rosterError} />
              </div>
            ) : soonest.length === 0 ? (
              <p className="rounded-card border bg-surface p-5 text-[13.5px] text-muted-foreground">
                No specialists are published yet. Please check back shortly.
              </p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-3">
                {soonest.map((specialist) => (
                  <DoctorCard
                    key={specialist.id}
                    specialist={specialist}
                    nextAvailable={nextAvailable[specialist.id]}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeading title="Our branches" href="/branches" linkLabel="Details" />
            <div className="grid gap-3 sm:grid-cols-2">
              {branches.map((branch) => (
                <Link
                  key={branch.id}
                  href={`/branches/${branch.slug}`}
                  className="card-hover flex items-center gap-3.5 rounded-card border bg-surface p-4"
                >
                  <span
                    aria-hidden
                    className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-tint-teal text-primary"
                  >
                    <Building2 className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">
                      {locale === 'ar' ? branch.nameAr : branch.nameEn}
                    </span>
                    <span className="block truncate text-[12px] text-muted-foreground">
                      {locale === 'ar' ? branch.areaAr : branch.areaEn}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-primary rtl:rotate-180" aria-hidden />
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-card border border-tint-gold-border bg-tint-gold p-5">
            <h2 className="inline-flex items-center gap-2 font-editorial text-[17px] font-semibold text-accent-foreground">
              <LifeBuoy className="h-[18px] w-[18px] shrink-0" aria-hidden />
              Not sure who to see?
            </h2>
            <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-accent-foreground/90">
              Tell us the reason for your visit and we&apos;ll route you to the right department —
              or contact the clinic and our team will help you choose.
            </p>
            <div className="mt-3.5 flex flex-wrap gap-2.5">
              <Button asChild size="sm" className="rounded-control">
                <Link href="/book/v2">
                  <CalendarCheck />
                  Book an appointment
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-control bg-surface">
                <Link href="/contact">Contact the clinic</Link>
              </Button>
            </div>
          </section>
      </div>
    </PatientShell>
  );
}

function SectionHeading({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-editorial text-[17px] font-semibold md:text-[22px]">{title}</h2>
      <Link href={href} className="text-[12.5px] font-semibold text-primary hover:underline">
        {linkLabel}
      </Link>
    </div>
  );
}
