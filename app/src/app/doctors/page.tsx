import Link from 'next/link';
import { Search, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/domain/page-header';
import { EmptyState, ErrorState } from '@/components/domain/states';
import { getDataProvider } from '@/lib/data';
import { formatCurrency } from '@/lib/utils';
import type { Practitioner } from '@/lib/data/types';

export const dynamic = 'force-dynamic';

export default async function FindDoctorPage({ searchParams }: { searchParams: Promise<{ q?: string; specialty?: string }> }) {
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

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-sm font-semibold tracking-tight">Clinic Platform</Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost"><Link href="/account/appointments">My appointments</Link></Button>
          <Button asChild variant="outline"><Link href="/login">Sign in</Link></Button>
        </div>
      </header>

      <PageHeader
        title="Find a doctor"
        description="Browse our clinic's doctors and book an appointment."
      />

      <form className="flex flex-wrap gap-2" method="GET">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q ?? ''} placeholder="Search by name or specialty…" className="w-72 pl-9" />
        </div>
        <select
          name="specialty"
          defaultValue={specialty ?? ''}
          className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All specialties</option>
          {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Button type="submit" variant="outline">Search</Button>
      </form>

      {error ? (
        <Card><CardContent className="p-0"><ErrorState description={error} /></CardContent></Card>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((d) => (
            <Card key={d.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Stethoscope className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{d.title} {d.firstName} {d.lastName}</h3>
                    <p className="truncate text-sm text-muted-foreground">{d.specialty}</p>
                  </div>
                </div>
                {d.bio && <p className="line-clamp-3 text-sm text-muted-foreground">{d.bio}</p>}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="text-sm text-muted-foreground">
                    Consultation · <span className="font-medium text-foreground">{formatCurrency(d.consultationFeeMinor, d.currency)}</span>
                  </span>
                  <Button asChild size="sm">
                    <Link href={`/doctors/${d.id}`}>View</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
