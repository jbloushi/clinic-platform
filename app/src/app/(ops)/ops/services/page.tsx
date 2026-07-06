import { revalidatePath } from 'next/cache';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/domain/page-header';
import { EmptyState } from '@/components/domain/states';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';
import { formatCurrency } from '@/lib/utils';
import { NewServiceDialog } from './new-service-dialog';

export const dynamic = 'force-dynamic';

async function toggleActive(id: string, active: boolean) {
  'use server';
  await requireStaff(['admin']);
  await prisma.service.update({ where: { id }, data: { active } });
  revalidatePath('/ops/services');
}

export default async function ServicesPage() {
  const services = await prisma.service.findMany({ orderBy: { createdAt: 'asc' } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        description="Visit types and procedures with their durations and fees. Used by booking and billing."
        actions={<NewServiceDialog />}
      />
      {services.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              title="No services yet"
              description="Add consultation types so patients can choose what to book."
              action={<NewServiceDialog />}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.durationMinutes} min</TableCell>
                  <TableCell>{formatCurrency(s.priceMinor, s.currency)}</TableCell>
                  <TableCell>
                    {s.active ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <form action={async () => { 'use server'; await toggleActive(s.id, !s.active); }}>
                      <Button type="submit" size="sm" variant="ghost">
                        {s.active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </form>
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
