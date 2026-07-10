import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/domain/page-header';
import { StatusBadge } from '@/components/domain/status-badge';
import { EmptyState } from '@/components/domain/states';
import { getDataProvider } from '@/lib/data';
import { getWalletBalance, listWalletTransactions } from '@/lib/data/platform-repo';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dp = getDataProvider();
  const patient = await dp.getPatientById(id);
  if (!patient) notFound();

  const [appointments, identity] = await Promise.all([
    dp.getAppointments({ patientId: id }).catch(() => []),
    prisma.patientIdentity.findUnique({ where: { openemrPatientUuid: id } }),
  ]);
  const walletTx = identity ? await listWalletTransactions(identity.id) : [];
  const walletBalance = identity ? await getWalletBalance(identity.id) : 0;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/ops/patients">
          <ChevronLeft className="h-4 w-4" /> Back to patients
        </Link>
      </Button>
      <PageHeader
        title={`${patient.firstName} ${patient.lastName}`}
        description={`${patient.dateOfBirth ?? 'DOB unknown'} · ${patient.sex ?? 'unknown'}`}
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Demographics</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <Field label="Mobile" value={patient.mobile} />
                <Field label="Email" value={patient.email} />
                <Field label="Address" value={patient.address} />
                <Field label="OpenEMR ID" value={patient.openemrPid ?? patient.id} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments">
          <Card>
            {appointments.length === 0 ? (
              <CardContent className="p-0">
                <EmptyState title="No appointments" description="This patient has no scheduled visits." />
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date &amp; time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{formatDateTime(a.start)}</TableCell>
                      <TableCell><StatusBadge status={a.status} /></TableCell>
                      <TableCell className="text-muted-foreground">{a.reason ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="wallet">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium text-muted-foreground">Balance</CardTitle>
              <p className="text-3xl font-semibold tabular-nums">{formatCurrency(walletBalance)}</p>
            </CardHeader>
            <CardContent>
              {walletTx.length === 0 ? (
                <EmptyState title="No wallet activity" description="Grants and payments will appear here." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {walletTx.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>{formatDateTime(tx.createdAt.toISOString())}</TableCell>
                        <TableCell className="capitalize">{tx.source.replace(/_/g, ' ')}</TableCell>
                        <TableCell className={`text-right font-medium ${tx.amountMinor >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {tx.amountMinor >= 0 ? '+' : ''}{formatCurrency(tx.amountMinor, tx.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}
