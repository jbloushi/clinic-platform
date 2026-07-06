import Link from 'next/link';
import { CalendarPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/domain/page-header';
import { StatusBadge } from '@/components/domain/status-badge';
import { EmptyState } from '@/components/domain/states';
import { prisma } from '@/lib/db';
import { requirePatient } from '@/lib/auth/guards';
import { getDataProvider } from '@/lib/data';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function MyAppointmentsPage() {
  const patient = await requirePatient();
  const dp = getDataProvider();

  const holds = await prisma.bookingHold.findMany({
    where: { patientIdentityId: patient.id, status: { in: ['confirmed', 'held', 'pending_payment'] } },
    orderBy: { startAt: 'asc' },
  });

  const doctorIds = Array.from(new Set(holds.map((h) => h.practitionerOpenemrId)));
  const doctors = await Promise.all(doctorIds.map((id) => dp.getPractitionerById(id).catch(() => null)));
  const doctorMap = new Map(doctors.filter(Boolean).map((d) => [d!.id, d!]));

  return (
    <div>
      <PageHeader
        title="My appointments"
        description="Upcoming and past visits."
        actions={
          <Button asChild>
            <Link href="/doctors"><CalendarPlus className="h-4 w-4" /> Book a new visit</Link>
          </Button>
        }
      />
      <div className="mt-6 space-y-3">
        {holds.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                title="No upcoming appointments"
                description="Book your first visit."
                action={<Button asChild><Link href="/doctors">Find a doctor</Link></Button>}
              />
            </CardContent>
          </Card>
        ) : (
          holds.map((h) => {
            const doc = doctorMap.get(h.practitionerOpenemrId);
            return (
              <Card key={h.id}>
                <CardContent className="flex flex-wrap items-center gap-4 pt-6">
                  <div className="w-40 shrink-0">
                    <p className="text-sm font-semibold">{formatDateTime(h.startAt.toISOString())}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{doc ? `${doc.title} ${doc.firstName} ${doc.lastName}` : 'Doctor'}</p>
                    <p className="truncate text-sm text-muted-foreground">{doc?.specialty ?? h.reason ?? 'Consultation'}</p>
                  </div>
                  <StatusBadge status={h.status as any} />
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
