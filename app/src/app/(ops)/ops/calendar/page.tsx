import { PageHeader } from '@/components/domain/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorState, EmptyState } from '@/components/domain/states';
import { getDataProvider } from '@/lib/data';
import { prisma } from '@/lib/db';
import type { Appointment, Practitioner } from '@/lib/data/types';
import { CalendarBoard } from './calendar-board';

export const dynamic = 'force-dynamic';

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const day = date ?? new Date().toISOString().slice(0, 10);
  const dp = getDataProvider();

  let practitioners: Practitioner[] = [];
  let appointments: Appointment[] = [];
  let error: string | null = null;

  try {
    practitioners = await dp.getPractitioners({ activeOnly: true });
    if (practitioners.length > 0) {
      appointments = await dp.getAppointments({ from: day, to: day });
    }
  } catch (e: any) {
    error = e?.message ?? 'Failed to load calendar';
  }

  const services = await prisma.service.findMany({ where: { active: true } });
  const patientOptions = (await dp.getPatients({ limit: 100 }).catch(() => ({ items: [] }))).items.map((p) => ({
    id: p.id,
    label: `${p.firstName} ${p.lastName}${p.mobile ? ' · ' + p.mobile : ''}`,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" description="Day view of appointments by provider. Click a slot to create." />

      {error ? (
        <Card>
          <CardContent className="p-0">
            <ErrorState description={error} />
          </CardContent>
        </Card>
      ) : practitioners.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              title="No providers configured"
              description="Add providers first before scheduling."
            />
          </CardContent>
        </Card>
      ) : (
        <CalendarBoard
          day={day}
          practitioners={practitioners.map((p) => ({ id: p.id, name: `${p.title} ${p.firstName} ${p.lastName}`, specialty: p.specialty }))}
          appointments={appointments}
          services={services.map((s) => ({ id: s.id, name: s.name, durationMinutes: s.durationMinutes }))}
          patients={patientOptions}
        />
      )}
    </div>
  );
}
