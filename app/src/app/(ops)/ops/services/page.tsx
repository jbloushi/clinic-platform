import { revalidatePath } from 'next/cache';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/domain/page-header';
import { EmptyState } from '@/components/domain/states';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';
import { getDataProvider } from '@/lib/data';
import { getServiceSpecialistUuids } from '@/lib/data/platform-repo';
import { formatCurrency } from '@/lib/utils';
import { NewServiceDialog } from './new-service-dialog';
import { EditSpecialistsDialog, type SpecialistOption } from './edit-specialists-dialog';

export const dynamic = 'force-dynamic';

async function toggleActive(id: string, active: boolean) {
  'use server';
  await requireStaff(['admin']);
  await prisma.service.update({ where: { id }, data: { active } });
  revalidatePath('/ops/services');
}

async function toggleServiceSearch(id: string, showInServiceSearch: boolean) {
  'use server';
  await requireStaff(['admin']);
  await prisma.service.update({ where: { id }, data: { showInServiceSearch } });
  revalidatePath('/ops/services');
}

export default async function ServicesPage() {
  const services = await prisma.service.findMany({ orderBy: { createdAt: 'asc' } });

  const dp = getDataProvider();
  const [specialists, assignments] = await Promise.all([
    dp.getPractitioners({ activeOnly: true }).catch(() => []),
    Promise.all(services.map((s) => getServiceSpecialistUuids(s.id))),
  ]);
  const specialistOptions: SpecialistOption[] = specialists.map((sp) => ({
    uuid: sp.id,
    name: `${sp.title} ${sp.firstName} ${sp.lastName}`.trim(),
    specialty: sp.specialty,
  }));
  const specialistNameByUuid = new Map(specialistOptions.map((sp) => [sp.uuid, sp.name]));
  const assignedUuidsByService = new Map(services.map((s, i) => [s.id, assignments[i]]));

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
                <TableHead>Assigned to</TableHead>
                <TableHead>Search</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((s) => {
                const assignedUuids = assignedUuidsByService.get(s.id) ?? [];
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.durationMinutes} min</TableCell>
                    <TableCell>{formatCurrency(s.priceMinor, s.currency)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {assignedUuids.length === 0 ? (
                        <span className="italic">Any specialist</span>
                      ) : (
                        <span title={assignedUuids.map((u) => specialistNameByUuid.get(u) ?? u).join(', ')}>
                          {assignedUuids.length} specialist{assignedUuids.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.showInServiceSearch ? (
                        <Badge variant="secondary">In search</Badge>
                      ) : (
                        <Badge variant="outline">Doctor-only</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.active ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EditSpecialistsDialog
                          serviceId={s.id}
                          serviceName={s.name}
                          allSpecialists={specialistOptions}
                          selectedUuids={assignedUuids}
                        />
                        <form action={async () => { 'use server'; await toggleServiceSearch(s.id, !s.showInServiceSearch); }}>
                          <Button type="submit" size="sm" variant="ghost">
                            {s.showInServiceSearch ? 'Hide from search' : 'Show in search'}
                          </Button>
                        </form>
                        <form action={async () => { 'use server'; await toggleActive(s.id, !s.active); }}>
                          <Button type="submit" size="sm" variant="ghost">
                            {s.active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
