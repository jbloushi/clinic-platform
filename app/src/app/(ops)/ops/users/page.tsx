import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/domain/page-header';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/guards';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function toggleActive(id: string, active: boolean) {
  'use server';
  await requireStaff(['admin']);
  await prisma.staffUser.update({ where: { id }, data: { active } });
  revalidatePath('/ops/users');
}

export default async function UsersPage() {
  const users = await prisma.staffUser.findMany({ orderBy: { createdAt: 'asc' } });
  return (
    <div className="space-y-6">
      <PageHeader title="Users & roles" description="Staff accounts. Toggle access or edit a user's role and specialist link." />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.firstName} {u.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{u.active ? <Badge>Active</Badge> : <Badge variant="outline">Disabled</Badge>}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(u.createdAt.toISOString())}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/ops/users/${u.id}`}>Edit</Link>
                      </Button>
                      <form action={async () => { 'use server'; await toggleActive(u.id, !u.active); }}>
                        <Button type="submit" size="sm" variant="ghost">
                          {u.active ? 'Disable' : 'Enable'}
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
