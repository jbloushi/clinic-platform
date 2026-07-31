import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PatientShell } from '@/components/domain/patient-shell';
import { EmptyState } from '@/components/domain/states';
import { listDepartments } from '@/lib/data/reference-repo';
import { getLocale } from '@/lib/i18n-server';

export const revalidate = 300;

export const metadata = { title: 'Departments' };

export default async function DepartmentsPage() {
  const [locale, departments] = await Promise.all([
    getLocale(),
    listDepartments({ publishedOnly: true }),
  ]);

  return (
    <PatientShell>
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-12">
        <p className="text-sm font-semibold text-primary">Clinical departments</p>
        <h1 className="mt-2 font-editorial text-[28px] font-semibold tracking-tight md:text-4xl">
          Specialist care, clearly organised
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
          Explore each department, then book with the appropriate service or doctor.
        </p>

        {departments.length === 0 ? (
          <div className="mt-8 rounded-card border bg-surface">
            <EmptyState
              title="No departments published yet"
              description="Please check back shortly, or browse our specialists directly."
            />
          </div>
        ) : (
          <div className="mt-8 divide-y rounded-card border bg-surface">
            {departments.map((department) => (
              <Link
                key={department.id}
                href={`/departments/${department.slug}`}
                className="grid gap-2 p-5 hover:bg-muted sm:grid-cols-[1fr_1.5fr_auto] sm:items-center md:p-6"
              >
                <h2 className="font-semibold">
                  {locale === 'ar' ? department.nameAr : department.nameEn}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {locale === 'ar' ? department.summaryAr : department.summaryEn}
                </p>
                <ArrowRight className="h-4 w-4 text-primary rtl:rotate-180" aria-hidden />
              </Link>
            ))}
          </div>
        )}
      </div>
    </PatientShell>
  );
}
