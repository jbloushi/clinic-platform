import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/domain/page-header';
import { StatusBadge } from '@/components/domain/status-badge';
import { EmptyState, ErrorState } from '@/components/domain/states';
import { getDataProvider } from '@/lib/data';
import { requireStaff } from '@/lib/auth/guards';
import { formatTime } from '@/lib/utils';
import type { Appointment, Practitioner } from '@/lib/data/types';

export const dynamic = 'force-dynamic';

export default async function DoctorSchedulePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const staff = await requireStaff(['doctor', 'admin']);
  const { date } = await searchParams;
  const day = date ?? new Date().toISOString().slice(0, 10);

  const dp = getDataProvider();
  let practitioner: Practitioner | null = null;
  let appointments: Appointment[] = [];
  let error: string | null = null;

  try {
    if (staff.openemrUserId) {
      practitioner = await dp.getPractitionerById(staff.openemrUserId);
    } else {
      // Fallback: pick the first active practitioner so the demo has something to display.
      const list = await dp.getPractitioners({ activeOnly: true });
      practitioner = list[0] ?? null;
    }
    if (practitioner) {
      appointments = await dp.getAppointments({ practitionerId: practitioner.id, from: day, to: day });
      appointments.sort((a, b) => a.start.localeCompare(b.start));
    }
  } catch (e: any) {
    error = e?.message ?? 'Failed to load schedule';
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Today's schedule"
        description={practitioner ? `${practitioner.title} ${practitioner.firstName} ${practitioner.lastName} · ${new Date(day).toDateString()}` : new Date(day).toDateString()}
      />

      {error ? (
        <Card>
          <CardContent className="p-0">
            <ErrorState description={error} />
          </CardContent>
        </Card>
      ) : !practitioner ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState title="No provider linked to this account" description="Ask admin to link your account to an OpenEMR practitioner." />
          </CardContent>
        </Card>
      ) : appointments.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState title="No appointments today" description="Enjoy the calm." />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {appointments.map((a) => (
            <Link
              key={a.id}
              href={`/doctor/consult/${a.id}?patient=${encodeURIComponent(a.patientId)}`}
              className="block"
            >
              <Card className="transition-colors hover:border-primary/40 hover:bg-primary/5">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="w-20 text-sm">
                    <div className="font-semibold">{formatTime(a.start)}</div>
                    <div className="text-xs text-muted-foreground">→ {formatTime(a.end)}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{a.patientName ?? `Patient ${a.patientId}`}</div>
                    <div className="truncate text-sm text-muted-foreground">{a.reason ?? 'Consultation'}</div>
                  </div>
                  <StatusBadge status={a.status} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
