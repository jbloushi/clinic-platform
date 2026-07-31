import { revalidatePath } from 'next/cache';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/domain/page-header';
import { EmptyState } from '@/components/domain/states';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';
import { getDataProvider } from '@/lib/data';
import { listBranches, getAllPractitionerBranchLinks } from '@/lib/data/reference-repo';
import { BranchDialog } from './branch-dialog';
import { LinkFacilityDialog, type FacilityOption } from './link-facility-dialog';
import { EditBranchPractitionersDialog } from './edit-branch-practitioners-dialog';
import { DeleteBranchButton } from './delete-branch-button';
import type { SpecialistOption } from '../services/edit-specialists-dialog';

export const dynamic = 'force-dynamic';

async function togglePublished(id: string, published: boolean) {
  'use server';
  await requireStaff(['admin']);

  // A published branch must resolve to a real facility, or bookings there would
  // silently be written against the env default — the wrong clinic.
  if (published) {
    const branch = await prisma.branch.findUnique({ where: { id } });
    if (!branch?.openemrFacilityId) return;
  }

  await prisma.branch.update({ where: { id }, data: { published } });
  revalidatePath('/ops/branches');
  revalidatePath('/branches');
  revalidatePath('/');
}

export default async function BranchesPage() {
  await requireStaff(['admin']);

  const dp = getDataProvider();
  const [branches, practitioners, links, facilities] = await Promise.all([
    listBranches(),
    dp.getPractitioners({ activeOnly: true }).catch(() => []),
    getAllPractitionerBranchLinks(),
    dp.getFacilities().catch(() => []),
  ]);

  const specialistOptions: SpecialistOption[] = practitioners.map((p) => ({
    uuid: p.id,
    name: `${p.title} ${p.firstName} ${p.lastName}`.trim(),
    specialty: p.specialty,
  }));
  const facilityOptions: FacilityOption[] = facilities.map((f) => ({
    id: f.id,
    name: f.name,
    address: f.address ?? null,
    active: f.active,
  }));
  const facilityNameById = new Map(facilities.map((f) => [f.id, f.name]));
  const takenFacilityIds = branches
    .map((b) => b.openemrFacilityId)
    .filter((id): id is number => id != null)
    .map(String);

  const assignedByBranch = new Map<string, string[]>();
  for (const [uuid, branchIds] of links) {
    for (const branchId of branchIds) {
      assignedByBranch.set(branchId, [...(assignedByBranch.get(branchId) ?? []), uuid]);
    }
  }
  const unrestricted = practitioners.filter((p) => !links.has(p.id)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branches"
        description="Clinic locations. Each one points at an OpenEMR facility, which is where its appointments are recorded."
        actions={<BranchDialog mode="create" />}
      />

      {unrestricted > 0 && practitioners.length > 0 && (
        <p className="flex items-start gap-2 rounded-card border border-tint-gold-border bg-tint-gold p-3.5 text-[12.5px] leading-relaxed text-accent-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {unrestricted} of {practitioners.length} doctors are not assigned to any branch, so they
            appear at all of them. Assign them per branch to restrict where they can be booked.
          </span>
        </p>
      )}

      {branches.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              title="No branches yet"
              description="Add each clinic location so patients can choose where to be seen."
              action={<BranchDialog mode="create" />}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead>OpenEMR facility</TableHead>
                <TableHead>Doctors</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch) => {
                const assigned = assignedByBranch.get(branch.id) ?? [];
                const facilityId = branch.openemrFacilityId;
                const facilityName = facilityId != null ? facilityNameById.get(String(facilityId)) : undefined;

                return (
                  <TableRow key={branch.id}>
                    <TableCell>
                      <div className="font-medium">{branch.nameEn}</div>
                      <div className="text-xs text-muted-foreground" dir="rtl">
                        {branch.nameAr}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        /{branch.slug}
                      </div>
                    </TableCell>
                    <TableCell>
                      {facilityId == null ? (
                        <span className="text-xs italic text-[#8A2E24]">Not linked</span>
                      ) : facilityName ? (
                        <span className="text-xs">
                          {facilityName}{' '}
                          <span className="font-mono text-muted-foreground">#{facilityId}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-[#8A2E24]">
                          #{facilityId} — not found in OpenEMR
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {assigned.length === 0 ? (
                        <span className="text-xs italic">All ({practitioners.length})</span>
                      ) : (
                        assigned.length
                      )}
                    </TableCell>
                    <TableCell>
                      {branch.published ? (
                        <Badge variant="secondary">Published</Badge>
                      ) : (
                        <Badge variant="outline">Hidden</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <LinkFacilityDialog
                          branchId={branch.id}
                          branchName={branch.nameEn}
                          currentFacilityId={facilityId != null ? String(facilityId) : null}
                          facilities={facilityOptions}
                          takenFacilityIds={takenFacilityIds}
                        />
                        <EditBranchPractitionersDialog
                          branchId={branch.id}
                          branchName={branch.nameEn}
                          allSpecialists={specialistOptions}
                          selectedUuids={assigned}
                        />
                        <BranchDialog mode="edit" branch={branch} />
                        <form
                          action={async () => {
                            'use server';
                            await togglePublished(branch.id, !branch.published);
                          }}
                        >
                          <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                            disabled={!branch.published && facilityId == null}
                            title={
                              !branch.published && facilityId == null
                                ? 'Link an OpenEMR facility before publishing'
                                : undefined
                            }
                          >
                            {branch.published ? 'Hide' : 'Publish'}
                          </Button>
                        </form>
                        <DeleteBranchButton branchId={branch.id} branchName={branch.nameEn} />
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
