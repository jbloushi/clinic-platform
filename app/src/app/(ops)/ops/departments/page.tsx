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
import { listDepartments, specialtyKey } from '@/lib/data/reference-repo';
import { DepartmentDialog } from './department-dialog';
import { EditSpecialtiesDialog, type SpecialtyOption } from './edit-specialties-dialog';
import { DeleteDepartmentButton } from './delete-department-button';

export const dynamic = 'force-dynamic';

async function togglePublished(id: string, published: boolean) {
  'use server';
  await requireStaff(['admin']);
  await prisma.department.update({ where: { id }, data: { published } });
  revalidatePath('/ops/departments');
  revalidatePath('/departments');
  revalidatePath('/');
}

export default async function DepartmentsPage() {
  await requireStaff(['admin']);

  const [departments, practitioners] = await Promise.all([
    listDepartments(),
    getDataProvider().getPractitioners({ activeOnly: true }).catch(() => []),
  ]);

  // The specialty vocabulary is whatever the live roster actually uses — there
  // is no canonical list in OpenEMR. Counting doctors per value lets ops see
  // what a mapping will really do before saving it.
  const counts = new Map<string, { specialty: string; doctors: number }>();
  for (const practitioner of practitioners) {
    const key = specialtyKey(practitioner.specialty);
    if (!key) continue;
    const entry = counts.get(key) ?? { specialty: practitioner.specialty, doctors: 0 };
    entry.doctors += 1;
    counts.set(key, entry);
  }
  const specialtyOptions: SpecialtyOption[] = Array.from(counts.values()).sort((a, b) =>
    a.specialty.localeCompare(b.specialty),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="How specialties are grouped for patients. OpenEMR stores a free-text specialty per doctor; a department collects those values under one name."
        actions={<DepartmentDialog mode="create" />}
      />

      {departments.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              title="No departments yet"
              description="Group specialties so patients can browse by area of care."
              action={<DepartmentDialog mode="create" />}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Specialties</TableHead>
                <TableHead>Doctors</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((department) => {
                const keys = new Set(department.specialties.map((s) => s.specialtyKey));
                const doctors = practitioners.filter((p) => keys.has(specialtyKey(p.specialty))).length;

                return (
                  <TableRow key={department.id}>
                    <TableCell>
                      <div className="font-medium">{department.nameEn}</div>
                      <div className="text-xs text-muted-foreground" dir="rtl">
                        {department.nameAr}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        /{department.slug}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[240px] text-muted-foreground">
                      {department.specialties.length === 0 ? (
                        <span className="italic text-[#8A2E24]">None mapped</span>
                      ) : (
                        <span className="line-clamp-2 text-xs">
                          {department.specialties.map((s) => s.specialty).join(', ')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {doctors === 0 && department.specialties.length > 0 ? (
                        <span className="text-xs text-[#8A2E24]">0 — no match</span>
                      ) : (
                        <span className="tabular-nums">{doctors}</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      <ServiceCount departmentId={department.id} />
                    </TableCell>
                    <TableCell>
                      {department.published ? (
                        <Badge variant="secondary">Published</Badge>
                      ) : (
                        <Badge variant="outline">Hidden</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EditSpecialtiesDialog
                          departmentId={department.id}
                          departmentName={department.nameEn}
                          allSpecialties={specialtyOptions}
                          selected={department.specialties.map((s) => s.specialty)}
                        />
                        <DepartmentDialog mode="edit" department={department} />
                        <form
                          action={async () => {
                            'use server';
                            await togglePublished(department.id, !department.published);
                          }}
                        >
                          <Button type="submit" size="sm" variant="ghost">
                            {department.published ? 'Hide' : 'Publish'}
                          </Button>
                        </form>
                        <DeleteDepartmentButton
                          departmentId={department.id}
                          departmentName={department.nameEn}
                        />
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

async function ServiceCount({ departmentId }: { departmentId: string }) {
  const count = await prisma.service.count({ where: { departmentId } });
  return <>{count}</>;
}
