import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, Phone } from 'lucide-react';
import { PatientShell } from '@/components/domain/patient-shell';
import { Button } from '@/components/ui/button';
import { getBranchBySlug } from '@/lib/data/reference-repo';
import { getLocale } from '@/lib/i18n-server';

export const revalidate = 300;

export default async function BranchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [locale, branch] = await Promise.all([getLocale(), getBranchBySlug(slug)]);

  if (!branch || !branch.published) notFound();

  const name = locale === 'ar' ? branch.nameAr : branch.nameEn;
  const area = locale === 'ar' ? branch.areaAr : branch.areaEn;

  return (
    <PatientShell>
      <div className="mx-auto max-w-4xl px-5 py-10 md:px-8 md:py-12">
        <Link href="/branches" className="text-sm font-semibold text-primary hover:underline">
          <span aria-hidden>←</span> All branches
        </Link>

        <h1 className="mt-6 font-editorial text-[28px] font-semibold md:text-4xl">{name}</h1>
        <p className="mt-3 text-[15px] text-muted-foreground">{area}</p>

        {(branch.addressLine || branch.phone) && (
          <dl className="mt-6 grid max-w-xl gap-3 text-sm">
            {branch.addressLine && (
              <div className="flex gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <dd>{branch.addressLine}</dd>
              </div>
            )}
            {branch.phone && (
              <div className="flex gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <dd>
                  <a href={`tel:${branch.phone}`} className="hover:underline">
                    {branch.phone}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        )}

        <div className="mt-8 rounded-card border bg-surface p-5 md:p-6">
          <h2 className="font-semibold">Plan your visit</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Choose this branch first, then see only the doctors and times available here.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button asChild className="rounded-control">
              <Link href={`/book?branch=${branch.slug}`}>Book at {name}</Link>
            </Button>
            {branch.mapUrl && (
              <Button asChild variant="outline" className="rounded-control">
                <a href={branch.mapUrl} target="_blank" rel="noreferrer noopener">
                  Open in maps
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </PatientShell>
  );
}
