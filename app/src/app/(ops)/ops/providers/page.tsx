import Link from 'next/link';
import { Plus, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/domain/page-header';
import { EmptyState, ErrorState } from '@/components/domain/states';
import { getDataProvider } from '@/lib/data';
import type { Practitioner } from '@/lib/data/types';

export const dynamic = 'force-dynamic';

export default async function ProvidersPage() {
  let practitioners: Practitioner[] = [];
  let error: string | null = null;
  try {
    practitioners = await getDataProvider().getPractitioners({ activeOnly: false });
  } catch (e: any) {
    error = e?.message ?? 'Failed to load providers from OpenEMR';
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Providers"
        description="Doctors and practitioners in OpenEMR. Create new ones here — everything is written to the EMR."
        actions={
          <Button asChild>
            <Link href="/ops/providers/new">
              <Plus className="h-4 w-4" /> Add provider
            </Link>
          </Button>
        }
      />

      {error ? (
        <Card>
          <CardContent className="p-0">
            <ErrorState title="Could not reach OpenEMR" description={error} />
          </CardContent>
        </Card>
      ) : practitioners.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Stethoscope className="h-5 w-5" />}
              title="No providers yet"
              description="Add your first doctor to make booking possible."
              action={
                <Button asChild>
                  <Link href="/ops/providers/new">
                    <Plus className="h-4 w-4" /> Add provider
                  </Link>
                </Button>
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
                <TableHead>Specialty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {practitioners.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.title} {p.firstName} {p.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.specialty}</TableCell>
                  <TableCell>
                    {p.active ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/ops/providers/${p.id}`}>Edit availability</Link>
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
