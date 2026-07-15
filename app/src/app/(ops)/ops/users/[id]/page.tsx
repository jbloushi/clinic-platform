import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/domain/page-header';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';
import { getDataProvider } from '@/lib/data';
import { formatDateTime } from '@/lib/utils';
import { EditStaffForm } from './edit-staff-form';

export const dynamic = 'force-dynamic';

export default async function StaffUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.staffUser.findUnique({ where: { id } });
  if (!user) notFound();

  const practitioners = await getDataProvider()
    .getPractitioners({ activeOnly: false })
    .catch(() => []);
  const practitionerOptions = practitioners.map((p) => ({
    id: p.id,
    name: `${p.title} ${p.firstName} ${p.lastName}`.trim(),
  }));

  async function toggleActive() {
    'use server';
    await requireStaff(['admin']);
    await prisma.staffUser.update({ where: { id }, data: { active: !user!.active } });
    revalidatePath(`/ops/users/${id}`);
    revalidatePath('/ops/users');
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/ops/users">
          <ChevronLeft className="h-4 w-4" /> Back to users
        </Link>
      </Button>
      <PageHeader
        title={`${user.firstName} ${user.lastName}`}
        description={`${user.email} · Created ${formatDateTime(user.createdAt.toISOString())}`}
        actions={
          <div className="flex items-center gap-2">
            {user.active ? <Badge>Active</Badge> : <Badge variant="outline">Disabled</Badge>}
            <form action={toggleActive}>
              <Button type="submit" size="sm" variant="outline">
                {user.active ? 'Disable' : 'Enable'}
              </Button>
            </form>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Role & specialist link</CardTitle>
        </CardHeader>
        <CardContent>
          <EditStaffForm
            staffId={user.id}
            initialRole={user.role}
            initialOpenemrUserId={user.openemrUserId}
            practitionerOptions={practitionerOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
