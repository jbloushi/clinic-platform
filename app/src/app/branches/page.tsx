import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { PatientShell } from '@/components/domain/patient-shell';
import { EmptyState } from '@/components/domain/states';
import { listBranches } from '@/lib/data/reference-repo';
import { getLocale } from '@/lib/i18n-server';

export const revalidate = 300;

export const metadata = { title: 'Branches' };

export default async function BranchesPage() {
  const [locale, branches] = await Promise.all([
    getLocale(),
    listBranches({ publishedOnly: true }),
  ]);

  return (
    <PatientShell>
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-12">
        <p className="text-sm font-semibold text-primary">Branches</p>
        <h1 className="mt-2 font-editorial text-[28px] font-semibold tracking-tight md:text-4xl">
          Care closer to you
        </h1>

        {branches.length === 0 ? (
          <div className="mt-8 rounded-card border bg-surface">
            <EmptyState
              title="No branches published yet"
              description="Please check back shortly, or contact the clinic for locations."
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {branches.map((branch) => (
              <Link
                key={branch.id}
                href={`/branches/${branch.slug}`}
                className="card-hover rounded-card border bg-surface p-5 md:p-6"
              >
                <MapPin className="h-6 w-6 text-primary" aria-hidden />
                <h2 className="mt-4 font-editorial text-[19px] font-semibold">
                  {locale === 'ar' ? branch.nameAr : branch.nameEn}
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {locale === 'ar' ? branch.areaAr : branch.areaEn}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PatientShell>
  );
}
