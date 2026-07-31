import Link from 'next/link';
import { PatientShell } from '@/components/domain/patient-shell';
import { EmptyState } from '@/components/domain/states';
import { listBookableServices } from '@/lib/data/service-catalog';
import { getLocale } from '@/lib/i18n-server';
import { formatPrice } from '@/lib/utils';

export const revalidate = 300;

export const metadata = { title: 'Services' };

export default async function ServicesPage() {
  const [locale, services] = await Promise.all([
    getLocale(),
    listBookableServices({ publishedOnWeb: true }),
  ]);

  return (
    <PatientShell>
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-12">
        <p className="text-sm font-semibold text-primary">Services</p>
        <h1 className="mt-2 font-editorial text-[28px] font-semibold tracking-tight md:text-4xl">
          Choose an appointment type
        </h1>

        {services.length === 0 ? (
          <div className="mt-8 rounded-card border bg-surface">
            <EmptyState
              title="No services published yet"
              description="Please check back shortly, or browse our specialists directly."
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {services.map((service) => (
              <Link
                key={service.id}
                href={`/services/${service.slug}`}
                className="card-hover rounded-card border bg-surface p-5 md:p-6"
              >
                <h2 className="font-semibold">
                  {locale === 'ar' ? (service.nameAr ?? service.name) : service.name}
                </h2>
                {(locale === 'ar' ? service.summaryAr : service.summaryEn) && (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {locale === 'ar' ? service.summaryAr : service.summaryEn}
                  </p>
                )}
                <p className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-primary">
                  <span>About {service.durationMinutes} minutes</span>
                  {service.priceMinor > 0 && (
                    <span className="font-editorial text-[14px] normal-case tracking-normal tabular-nums text-foreground">
                      {formatPrice(service.priceMinor, service.currency)}
                    </span>
                  )}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PatientShell>
  );
}
