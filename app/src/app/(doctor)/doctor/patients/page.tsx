import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/domain/page-header';
import { EmptyState, ErrorState } from '@/components/domain/states';
import { getDataProvider } from '@/lib/data';
import type { Patient } from '@/lib/data/types';

export const dynamic = 'force-dynamic';

export default async function DoctorPatientsPage() {
  let patients: Patient[] = [];
  let error: string | null = null;
  try {
    const res = await getDataProvider().getPatients({ limit: 100 });
    patients = res.items;
  } catch (e: any) {
    error = e?.message ?? 'Failed to load patients';
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Patients" description="All patients in the EMR. Click one to open the chart." />
      {error ? (
        <Card><ErrorState description={error} /></Card>
      ) : patients.length === 0 ? (
        <Card><EmptyState title="No patients" /></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>DOB</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.firstName} {p.lastName}</TableCell>
                  <TableCell className="text-muted-foreground">{p.mobile || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{p.dateOfBirth ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/doctor/patients/${p.id}`}>Open chart</Link>
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
