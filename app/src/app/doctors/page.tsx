import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/domain/page-header';
import { ErrorState } from '@/components/domain/states';
import { BrandWordmark } from '@/components/domain/brand-mark';
import { getDataProvider } from '@/lib/data';
import { formatNextAvailable } from '@/lib/specialist-meta';
import type { NextAvailable } from '@/lib/specialist-meta';
import type { Practitioner } from '@/lib/data/types';
import { SpecialistBrowser } from './specialist-browser';

export const dynamic = 'force-dynamic';

export default async function FindDoctorPage() {
  const dp = getDataProvider();
  let specialists: Practitioner[] = [];
  let error: string | null = null;
  try {
    specialists = await dp.getPractitioners({ activeOnly: true });
  } catch (e: any) {
    error = e?.message ?? 'Could not load specialists';
  }

  // Compute a "next available" hint per specialist (best-effort). Passed to the
  // client browser as a plain object so filtering stays purely client-side.
  const from = new Date().toISOString().slice(0, 10);
  const toDate = new Date();
  toDate.setDate(toDate.getDate() + 6);
  const to = toDate.toISOString().slice(0, 10);
  const nextAvailable: Record<string, NextAvailable> = {};
  await Promise.all(
    specialists.map(async (s) => {
      try {
        const slots = await dp.getAvailableSlots(s.id, from, to);
        const first = slots.find((sl) => sl.available);
        if (first) nextAvailable[s.id] = { iso: first.start, label: formatNextAvailable(first.start) };
      } catch {
        /* silent */
      }
    }),
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-card/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <Link href="/" aria-label="Home">
            <BrandWordmark />
          </Link>
          <div className="flex items-center gap-1.5">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/account/appointments">My appointments</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-10">
        <PageHeader
          eyebrow="Book online"
          title="Find a specialist"
          description="Choose a specialist, pick a time that suits you, and confirm in minutes."
        />

        {error ? (
          <Card>
            <CardContent className="p-0">
              <ErrorState description={error} />
            </CardContent>
          </Card>
        ) : (
          <SpecialistBrowser specialists={specialists} nextAvailable={nextAvailable} />
        )}
      </main>
    </div>
  );
}
