import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/domain/page-header';
import { EmptyState } from '@/components/domain/states';
import { requireStaff } from '@/lib/auth/guards';
import { getDataProvider } from '@/lib/data';
import { listPractitionerOfferings } from '@/lib/data/offering-repo';
import { listBranches, listDepartments } from '@/lib/data/reference-repo';
import { prisma } from '@/lib/db';
import { OfferingDialog } from './offering-dialog';
import { DeleteOfferingButton } from './delete-offering-button';
import { CopyOfferingsDialog } from './copy-offerings-dialog';
import type { SpecialistOption } from '../services/edit-specialists-dialog';

export const dynamic = 'force-dynamic';

const TIER_LABEL: Record<string, string> = { PREFERRED: 'Preferred', NORMAL: 'Normal', BACKUP: 'Backup' };

/**
 * Every doctor + service + department + branch combination that's actually
 * bookable. Nothing is inferred here from a doctor working at a branch and
 * that branch offering the service — the row is the only thing that makes a
 * combination real (see offering-repo.ts's parent-relationship gate).
 */
export default async function OfferingsPage() {
  await requireStaff(['admin']);

  const dp = getDataProvider();
  const [offerings, branches, departments, services, practitioners] = await Promise.all([
    listPractitionerOfferings(),
    listBranches(),
    listDepartments(),
    prisma.service.findMany({ orderBy: { name: 'asc' } }),
    dp.getPractitioners({ activeOnly: true }).catch(() => []),
  ]);

  const practitionerById = new Map(practitioners.map((p) => [p.id, p]));
  const specialistOptions: SpecialistOption[] = practitioners.map((p) => ({
    uuid: p.id,
    name: `${p.title} ${p.firstName} ${p.lastName}`.trim(),
    specialty: p.specialty,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offerings"
        description="Which doctor performs which service, under which department, at which branch. Auto-assignment and patient choice both read from this list — nothing else makes a combination bookable."
        actions={
          <div className="flex items-center gap-2">
            <CopyOfferingsDialog branches={branches.map((b) => ({ id: b.id, name: b.nameEn }))} />
            <OfferingDialog
              mode="create"
              specialists={specialistOptions}
              services={services.map((s) => ({ id: s.id, name: s.name }))}
              departments={departments.map((d) => ({ id: d.id, name: d.nameEn }))}
              branches={branches.map((b) => ({ id: b.id, name: b.nameEn }))}
            />
          </div>
        }
      />

      {offerings.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              title="No offerings yet"
              description="Without at least one, auto-assignment and patient choice both have an empty pool to pick from."
              action={
                <OfferingDialog
                  mode="create"
                  specialists={specialistOptions}
                  services={services.map((s) => ({ id: s.id, name: s.name }))}
                  departments={departments.map((d) => ({ id: d.id, name: d.nameEn }))}
                  branches={branches.map((b) => ({ id: b.id, name: b.nameEn }))}
                />
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Eligible for</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offerings.map((offering) => {
                const practitioner = practitionerById.get(offering.specialistOpenemrUuid);
                const name = practitioner
                  ? `${practitioner.title} ${practitioner.firstName} ${practitioner.lastName}`.trim()
                  : offering.specialistOpenemrUuid;

                return (
                  <TableRow key={offering.id}>
                    <TableCell>
                      <div className="font-medium">{name}</div>
                      {!practitioner && (
                        <div className="flex items-center gap-1 text-[11px] text-[#8A2E24]">
                          <AlertTriangle className="h-3 w-3" aria-hidden /> Not found in EMR
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>{offering.service.name}</div>
                      <div className="text-xs text-muted-foreground">{offering.department.nameEn}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{offering.branch.nameEn}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {offering.allowAutoAssignment && <Badge variant="secondary">Auto-assign</Badge>}
                        {offering.allowPatientChoice && <Badge variant="outline">Patient choice</Badge>}
                        {!offering.allowAutoAssignment && !offering.allowPatientChoice && (
                          <Badge variant="outline">Ops only</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {TIER_LABEL[offering.assignmentPriorityTier]} · {offering.assignmentPriority}
                    </TableCell>
                    <TableCell>
                      {offering.active && offering.publishedOnWeb ? (
                        <Badge variant="secondary">Live</Badge>
                      ) : (
                        <Badge variant="outline">{offering.active ? 'Unpublished' : 'Inactive'}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <OfferingDialog mode="edit" offering={offering} />
                        <DeleteOfferingButton offeringId={offering.id} label={`${name} · ${offering.service.name}`} />
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
