import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/domain/page-header';
import { StatusBadge } from '@/components/domain/status-badge';
import { getDataProvider } from '@/lib/data';
import { formatDateTime } from '@/lib/utils';
import { ConsultWorkspace } from './workspace';

export const dynamic = 'force-dynamic';

export default async function ConsultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ patient?: string }>;
}) {
  const { id } = await params;
  const { patient: patientParam } = await searchParams;
  const dp = getDataProvider();
  const appointment = await dp.getAppointmentById(id);
  if (!appointment) notFound();
  const patientId = patientParam ?? appointment.patientId;
  const [patient, history] = await Promise.all([
    dp.getPatientById(patientId),
    dp.getPatientMedicalHistory(patientId).catch(() => ({ problems: [], allergies: [], medications: [], vitals: [], documents: [] })),
  ]);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/doctor/schedule"><ChevronLeft className="h-4 w-4" /> Back to schedule</Link>
      </Button>
      <PageHeader
        title={patient ? `${patient.firstName} ${patient.lastName}` : 'Consultation'}
        description={`${formatDateTime(appointment.start)} · ${appointment.reason ?? 'Consultation'}`}
        actions={<StatusBadge status={appointment.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ConsultWorkspace appointmentId={appointment.id} patientId={patientId} />

        <div className="space-y-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm text-muted-foreground">Problems</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {history.problems.length === 0 ? '—' : (
                <ul className="space-y-1">
                  {history.problems.slice(0, 6).map((p, i) => <li key={i}>• {p.label}</li>)}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm text-muted-foreground">Allergies</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {history.allergies.length === 0 ? '—' : (
                <ul className="space-y-1">
                  {history.allergies.slice(0, 6).map((a, i) => <li key={i}>• {a.substance}</li>)}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm text-muted-foreground">Medications</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {history.medications.length === 0 ? '—' : (
                <ul className="space-y-1">
                  {history.medications.slice(0, 6).map((m, i) => <li key={i}>• {m.name}</li>)}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
