import Link from 'next/link';
import { Search, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/domain/page-header';
import { EmptyState, ErrorState } from '@/components/domain/states';
import { DoctorCard } from '@/components/domain/doctor-card';
import { BrandWordmark } from '@/components/domain/brand-mark';
import { getDataProvider } from '@/lib/data';
import type { Practitioner } from '@/lib/data/types';

export const dynamic = 'force-dynamic';

export default async function FindDoctorPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; specialty?: string }>;
}) {
  const { q, specialty } = await searchParams;
  const dp = getDataProvider();
  let doctors: Practitioner[] = [];
  let error: string | null = null;
  try {
    doctors = await dp.getPractitioners({ query: q, specialty, activeOnly: true });
  } catch (e: any) {
    error = e?.message ?? 'Could not load doctors';
  }
  const specialties = Array.from(new Set(doctors.map((d) => d.specialty))).sort();

  // Compute a "next available" hint per doctor (best-effort; fine if it returns none).
  const from = new Date().toISOString().slice(0, 10);
  const toDate = new Date();
  toDate.setDate(toDate.getDate() + 6);
  const to = toDate.toISOString().slice(0, 10);
  const nextByDoctor = new Map<string, string>();
  await Promise.all(
    doctors.slice(0, 12).map(async (d) => {
      try {
        const slots = await dp.getAvailableSlots(d.id, from, to);
        const first = slots.find((s) => s.available);
        if (first) nextByDoctor.set(d.id, formatWhen(first.start));
      } catch {
        /* silent */
      }
    }),
  );

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/" aria-label="Home">
            <BrandWordmark />
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/account/appointments">My appointments</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
        <PageHeader
          eyebrow="Book online"
          title="Find a doctor"
          description="Choose a doctor, pick a time that suits you, and confirm in minutes."
        />

        <form className="flex flex-wrap gap-2" method="GET">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q ?? ''}
              placeholder="Search by name or specialty…"
              className="w-72 pl-9"
              aria-label="Search doctors"
            />
          </div>
          <select
            name="specialty"
            defaultValue={specialty ?? ''}
            aria-label="Filter by specialty"
            className="flex h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">All specialties</option>
            {specialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline">
            Search
          </Button>
          {(q || specialty) && (
            <Button asChild variant="ghost">
              <Link href="/doctors">Clear</Link>
            </Button>
          )}
        </form>

        {error ? (
          <Card>
            <CardContent className="p-0">
              <ErrorState description={error} />
            </CardContent>
          </Card>
        ) : doctors.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={<Stethoscope className="h-5 w-5" />}
                title="No matching doctors"
                description="Try a different search or specialty."
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{doctors.length}</span>{' '}
              {doctors.length === 1 ? 'doctor' : 'doctors'}
              {specialty ? ` in ${specialty}` : ''}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {doctors.map((d) => (
                <DoctorCard key={d.id} doctor={d} nextAvailable={nextByDoctor.get(d.id)} />
              ))}
            </div>
          </>
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
  if (isSame(d, today)) return `today at ${time}`;
  if (isSame(d, tomorrow)) return `tomorrow at ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`;
}
