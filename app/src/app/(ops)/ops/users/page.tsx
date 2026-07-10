import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/domain/page-header';
import { prisma } from '@/lib/db';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const users = await prisma.staffUser.findMany({ orderBy: { createdAt: 'asc' } });
  return (
    <div className="space-y-6">
      <PageHeader title="Users & roles" description="Staff accounts. Adding new staff via UI is planned for Phase 3." />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.firstName} {u.lastName}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{u.role}</Badge></TableCell>
                <TableCell>{u.active ? <Badge>Active</Badge> : <Badge variant="outline">Disabled</Badge>}</TableCell>
                <TableCell className="text-muted-foreground">{formatDateTime(u.createdAt.toISOString())}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
