import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/domain/page-header';
import { EmptyState } from '@/components/domain/states';
import { prisma } from '@/lib/db';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const total = payments.filter((p) => p.status === 'succeeded').reduce((s, p) => s + p.amountMinor, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Billing &amp; payments" description="Payments recorded in the platform. OpenEMR billing sync is planned for Phase 3." />

      <Card>
        <CardContent className="pt-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total collected</p>
          <p className="text-2xl font-semibold">{formatCurrency(total)}</p>
        </CardContent>
      </Card>

      <Card>
        {payments.length === 0 ? (
          <CardContent className="p-0">
            <EmptyState title="No payments yet" description="Bookings and manual payments will show up here." />
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDateTime(p.createdAt.toISOString())}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(p.amountMinor, p.currency)}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{p.method.replace(/_/g, ' ')}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'succeeded' ? 'secondary' : 'outline'}>{p.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
