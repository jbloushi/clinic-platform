import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PatientShell } from '@/components/domain/patient-shell';
import { Button } from '@/components/ui/button';
import { getBookableService } from '@/lib/data/service-catalog';
import { getDepartmentBySlug } from '@/lib/data/reference-repo';
import { getLocale } from '@/lib/i18n-server';
import { formatPrice } from '@/lib/utils';

export const revalidate = 300;

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [locale, service] = await Promise.all([getLocale(), getBookableService(slug)]);

  if (!service || !service.active || !service.publishedOnWeb) notFound();

  const department = service.departmentSlug
    ? await getDepartmentBySlug(service.departmentSlug)
    : null;

  const name = locale === 'ar' ? (service.nameAr ?? service.name) : service.name;
  const summary = locale === 'ar' ? service.summaryAr : service.summaryEn;

  return (
    <PatientShell>
      <div className="mx-auto max-w-4xl px-5 py-10 md:px-8 md:py-12">
        <Link href="/services" className="text-sm font-semibold text-primary hover:underline">
          <span aria-hidden>←</span> All services
        </Link>

        {department && (
          <Link
            href={`/departments/${department.slug}`}
            className="mt-7 block text-sm font-semibold text-primary hover:underline"
          >
            {locale === 'ar' ? department.nameAr : department.nameEn}
          </Link>
        )}
        <h1 className="mt-2 font-editorial text-[28px] font-semibold md:text-4xl">{name}</h1>
        {summary && (
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            {summary}
          </p>
        )}

        <dl className="mt-8 grid max-w-xl gap-4 rounded-card border bg-surface p-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Typical duration</dt>
            <dd className="font-semibold">{service.durationMinutes} minutes</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Fee</dt>
            {/* The real configured price, now that this page reads the same row
                booking charges from. It used to say "confirmed before booking"
                because the public catalogue had no price at all. */}
            <dd className="font-semibold tabular-nums">
              {service.priceMinor > 0
                ? formatPrice(service.priceMinor, service.currency)
                : 'Confirmed before booking'}
            </dd>
          </div>
        </dl>

        <Button asChild size="lg" className="mt-8 rounded-control">
          <Link href={`/book/v2?service=${service.slug}`}>Book this service</Link>
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">
          Preparation instructions, if required, will be shown with your appointment confirmation.
        </p>
      </div>
    </PatientShell>
  );
}
