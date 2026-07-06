import Link from 'next/link';
import { CalendarDays, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/domain/page-header';
import { StatusBadge } from '@/components/domain/status-badge';
import { EmptyState } from '@/components/domain/states';
import { getDataProvider } from '@/lib/data';
import { requireStaff } from '@/lib/auth/guards';
import { formatTime } from '@/lib/utils';
import type { Appointment } from '@/lib/data/types';

export const dynamic = 'force-dynamic';

export default async function DoctorDashboardPage() {
  const staff = await requireStaff(['doctor', 'admin']);
  const today = new Date().toISOString().slice(0, 10);
  const dp = getDataProvider();

  let practitionerId = staff.openemrUserId;
  if (!practitionerId) {
    const list = await dp.getPractitioners({ activeOnly: true }).catch(() => []);
    practitionerId = list[0]?.id;
  }
  let appointments: Appointment[] = [];
  if (practitionerId) {
    appointments = await dp.getAppointments({ practitionerId, from: today, to: today }).catch(() => []);
    appointments.sort((a, b) => a.start.localeCompare(b.start));
  }
  const next = appointments.find((a) => new Date(a.start).getTime() > Date.now());

  return (
    <div className="space-y-6">
      <PageHeader title={`Good day, Dr. ${staff.firstName}`} description={new Date().toDateString()} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-md bg-primary/10 p-2 text-primary"><CalendarDays className="h-4 w-4" /></div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Appointments today</p>
              <p className="text-xl font-semibold">{appointments.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4"><CardTitle className="text-sm text-muted-foreground">Next patient</CardTitle></CardHeader>
          <CardContent>
            {next ? (
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-semibold">{next.patientName ?? next.patientId}</p>
                  <p className="text-xs text-muted-foreground">at {formatTime(next.start)} · {next.reason ?? 'Consultation'}</p>
                </div>
                <StatusBadge status={next.status} />
                <Button asChild size="sm" className="ml-auto">
                  <Link href={`/doctor/consult/${next.id}?patient=${encodeURIComponent(next.patientId)}`}>Open consult</Link>
                </Button>
              </div>
            ) : (
              <EmptyState title="No more patients today" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Today&apos;s schedule</CardTitle></CardHeader>
        <CardContent className="p-0">
          {appointments.length === 0 ? (
            <EmptyState title="Nothing on the calendar today" />
          ) : (
            <ul className="divide-y">
              {appointments.map((a) => (
                <li key={a.id} className="flex items-center gap-3 p-4">
                  <div className="w-16 text-sm font-medium">{formatTime(a.start)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.patientName ?? a.patientId}</p>
                    <p className="truncate text-sm text-muted-foreground">{a.reason ?? 'Consultation'}</p>
                  </div>
                  <StatusBadge status={a.status} />
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/doctor/consult/${a.id}?patient=${encodeURIComponent(a.patientId)}`}>Open</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
