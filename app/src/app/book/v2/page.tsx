import { BookShell } from '@/components/domain/book-shell';
import { listBranches } from '@/lib/data/reference-repo';
import { getLocale } from '@/lib/i18n-server';
import { V2Entry } from './entry';

export const dynamic = 'force-dynamic';

export default async function BookV2Page({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const { branch } = await searchParams;
  const locale = await getLocale();
  const branches = await listBranches({ publishedOnly: true });

  return (
    <BookShell
      backHref="/"
      title="Let's find the right appointment"
      description="Real-time doctor assignment, availability and payment — start with a branch."
    >
      <V2Entry
        branches={branches.map((item) => ({
          slug: item.slug,
          name: locale === 'ar' ? item.nameAr : item.nameEn,
          area: locale === 'ar' ? item.areaAr : item.areaEn,
        }))}
        initialBranch={branch}
      />
    </BookShell>
  );
}
