import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/domain/page-header';
import { ErrorState } from '@/components/domain/states';
import { BrandWordmark } from '@/components/domain/brand-mark';
import { getDataProvider } from '@/lib/data';
import type { Practitioner } from '@/lib/data/types';
import { DoctorBrowser } from './doctor-browser';

export const dynamic = 'force-dynamic';

export default async function FindDoctorPage() {
  const dp = getDataProvider();
  let doctors: Practitioner[] = [];
  let error: string | null = null;
  try {
    doctors = await dp.getPractitioners({ activeOnly: true });
  } catch (e: any) {
    error = e?.message ?? 'Could not load doctors';
  }

  // Compute a "next available" hint per doctor (best-effort). Passed to the
  // client browser as a plain object so filtering stays purely client-side.
  const from = new Date().toISOString().slice(0, 10);
  const toDate = new Date();
  toDate.setDate(toDate.getDate() + 6);
  const to = toDate.toISOString().slice(0, 10);
  const nextAvailable: Record<string, string> = {};
  await Promise.all(
    doctors.map(async (d) => {
      try {
        const slots = await dp.getAvailableSlots(d.id, from, to);
        const first = slots.find((s) => s.available);
        if (first) nextAvailable[d.id] = formatWhen(first.start);
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
          title="Find a doctor"
          description="Choose a doctor, pick a time that suits you, and confirm in minutes."
        />

        {error ? (
          <Card>
            <CardContent className="p-0">
              <ErrorState description={error} />
            </CardContent>
          </Card>
        ) : (
          <DoctorBrowser doctors={doctors} nextAvailable={nextAvailable} />
        )}
      </main>
    </div>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const isSame = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isSame(d, today)) return `Today at ${time}`;
  if (isSame(d, tomorrow)) return `Tomorrow at ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`;
}
