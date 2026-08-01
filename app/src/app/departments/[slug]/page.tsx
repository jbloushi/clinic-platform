import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PatientShell } from '@/components/domain/patient-shell';
import { Button } from '@/components/ui/button';
import { getDepartmentBySlug } from '@/lib/data/reference-repo';
import { listBookableServices } from '@/lib/data/service-catalog';
import { getLocale } from '@/lib/i18n-server';
import { formatPrice } from '@/lib/utils';

export const revalidate = 300;

export default async function DepartmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [locale, department] = await Promise.all([getLocale(), getDepartmentBySlug(slug)]);

  // An unpublished department is a draft, and there is no preview path — 404
  // rather than serving work in progress.
  if (!department || !department.published) notFound();

  const services = await listBookableServices({ publishedOnWeb: true, departmentSlug: slug });

  const name = locale === 'ar' ? department.nameAr : department.nameEn;
  const summary = locale === 'ar' ? department.summaryAr : department.summaryEn;

  return (
    <PatientShell>
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-12">
        <Link href="/departments" className="text-sm font-semibold text-primary hover:underline">
          <span aria-hidden>←</span> All departments
        </Link>

        <h1 className="mt-5 font-editorial text-[28px] font-semibold md:text-4xl">{name}</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{summary}</p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild className="rounded-control">
            <Link href={`/book/v2?department=${department.slug}`}>Book in this department</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-control">
            {/* By department slug, not by specialty name. The doctor list resolves
                the slug to the set of OpenEMR specialty values mapped to it —
                passing a display name here could never match the free-text
                specialty on a real practitioner record. */}
            <Link href={`/doctors?department=${department.slug}`}>View doctors</Link>
          </Button>
        </div>

        {services.length > 0 && (
          <section className="mt-11">
            <h2 className="font-editorial text-[22px] font-semibold">Available services</h2>
            <div className="mt-4 divide-y rounded-card border bg-surface">
              {services.map((service) => (
                <Link
                  key={service.id}
                  href={`/services/${service.slug}`}
                  className="flex items-center justify-between gap-4 p-5 hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {locale === 'ar' ? (service.nameAr ?? service.name) : service.name}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {(locale === 'ar' ? service.summaryAr : service.summaryEn) ??
                        `${service.durationMinutes} minutes`}
                    </span>
                  </span>
                  {service.priceMinor > 0 && (
                    <span className="shrink-0 font-editorial text-[15px] font-semibold tabular-nums">
                      {formatPrice(service.priceMinor, service.currency)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </PatientShell>
  );
}
