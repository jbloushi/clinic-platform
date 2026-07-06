import { CalendarDays, LayoutDashboard, Stethoscope, Users, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/domain/page-header';
import { StatCard } from '@/components/domain/stat-card';
import { StatusBadge } from '@/components/domain/status-badge';
import { EmptyState } from '@/components/domain/states';
import { getDataProvider } from '@/lib/data';
import { prisma } from '@/lib/db';
import { formatCurrency, formatTime } from '@/lib/utils';
import type { Appointment, Practitioner } from '@/lib/data/types';

export const dynamic = 'force-dynamic';

export default async function OpsDashboardPage() {
  const today = new Date().toISOString().slice(0, 10);
  const dp = getDataProvider();

  let practitioners: Practitioner[] = [];
  let todaysAppointments: Appointment[] = [];
  let patientTotal = 0;
  try {
    [practitioners, todaysAppointments] = await Promise.all([
      dp.getPractitioners({ activeOnly: true }),
      dp.getAppointments({ from: today, to: today }),
    ]);
    patientTotal = (await dp.getPatients({ limit: 1 })).total;
  } catch {}

  const revenueMinor = await prisma.payment
    .aggregate({
      where: { status: 'succeeded', createdAt: { gte: new Date(today) } },
      _sum: { amountMinor: true },
    })
    .then((r) => r._sum.amountMinor ?? 0);
  const noShowCount = todaysAppointments.filter((a) => a.status === 'no_show').length;

  const checkedIn = todaysAppointments.filter((a) => a.status === 'checked_in').length;
  const completed = todaysAppointments.filter((a) => a.status === 'completed').length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        icon={<LayoutDashboard className="h-5 w-5" />}
        title="Today at a glance"
        description={new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Appointments"
          value={String(todaysAppointments.length)}
          helper={completed > 0 ? `${completed} completed · ${checkedIn} in room` : undefined}
        />
        <StatCard
          icon={<Wallet className="h-4 w-4" />}
          label="Revenue today"
          value={formatCurrency(revenueMinor)}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Patients (total)"
          value={String(patientTotal)}
        />
        <StatCard
          icon={<Stethoscope className="h-4 w-4" />}
          label="Active providers"
          value={String(practitioners.length)}
        />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Today&apos;s schedule</CardTitle></CardHeader>
        <CardContent className="p-0">
          {todaysAppointments.length === 0 ? (
            <EmptyState title="No appointments today" description="Bookings and walk-ins will show up here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todaysAppointments
                  .sort((a, b) => a.start.localeCompare(b.start))
                  .map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{formatTime(a.start)}</TableCell>
                      <TableCell>{a.patientName ?? a.patientId}</TableCell>
                      <TableCell><StatusBadge status={a.status} /></TableCell>
                      <TableCell className="text-muted-foreground">{a.reason ?? '—'}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {noShowCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {noShowCount} no-show{noShowCount === 1 ? '' : 's'} today.
        </p>
      )}
    </div>
  );
}

