import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { Plus, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/domain/page-header';
import { EmptyState, ErrorState } from '@/components/domain/states';
import { getDataProvider } from '@/lib/data';
import { requireStaff } from '@/lib/auth/guards';
import type { Practitioner } from '@/lib/data/types';

export const dynamic = 'force-dynamic';

async function toggleActive(id: string, active: boolean) {
  'use server';
  await requireStaff(['admin']);
  await getDataProvider().setPractitionerActive(id, active);
  revalidatePath('/ops/providers');
}

export default async function ProvidersPage() {
  let practitioners: Practitioner[] = [];
  let error: string | null = null;
  try {
    practitioners = await getDataProvider().getPractitioners({ activeOnly: false });
  } catch (e: any) {
    error = e?.message ?? 'Failed to load specialists from OpenEMR';
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Specialists"
        description="Specialists in OpenEMR — doctors, nurses, technicians. Create new ones here; everything is written to the EMR."
        actions={
          <Button asChild>
            <Link href="/ops/providers/new">
              <Plus className="h-4 w-4" /> Add specialist
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
              title="No specialists yet"
              description="Add your first specialist to make booking possible."
              action={
                <Button asChild>
                  <Link href="/ops/providers/new">
                    <Plus className="h-4 w-4" /> Add specialist
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
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/ops/providers/${p.id}`}>Edit</Link>
                      </Button>
                      <form action={async () => { 'use server'; await toggleActive(p.id, !p.active); }}>
                        <Button type="submit" size="sm" variant="ghost">
                          {p.active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </form>
                    </div>
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
