import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/domain/page-header';
import { EmptyState, ErrorState } from '@/components/domain/states';
import { getDataProvider } from '@/lib/data';
import type { Patient } from '@/lib/data/types';

export const dynamic = 'force-dynamic';

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  let patients: Patient[] = [];
  let error: string | null = null;
  try {
    const res = await getDataProvider().getPatients({ query: q, limit: 100 });
    patients = res.items;
  } catch (e: any) {
    error = e?.message ?? 'Failed to load patients';
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patients"
        description="Directory of all patients in OpenEMR."
        actions={
          <Button asChild>
            <Link href="/ops/patients/new">
              <Plus className="h-4 w-4" /> Register patient
            </Link>
          </Button>
        }
      />

      <form className="flex gap-2" method="GET">
        <Input name="q" defaultValue={q ?? ''} placeholder="Search by name…" className="max-w-sm" />
        <Button type="submit" variant="outline">Search</Button>
      </form>

      {error ? (
        <Card>
          <CardContent className="p-0">
            <ErrorState description={error} />
          </CardContent>
        </Card>
      ) : patients.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title={q ? 'No patients match' : 'No patients yet'}
              description={q ? 'Try a different search.' : 'Register the first patient to get started.'}
              action={
                !q ? (
                  <Button asChild>
                    <Link href="/ops/patients/new">
                      <Plus className="h-4 w-4" /> Register patient
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>DOB</TableHead>
                <TableHead>Sex</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <Link href={`/ops/patients/${p.id}`} className="hover:underline">
                      {p.firstName} {p.lastName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.mobile || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{p.dateOfBirth ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground capitalize">{p.sex ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/ops/patients/${p.id}`}>Open</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
