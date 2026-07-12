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
import { cn, formatDateTime } from '@/lib/utils';
import { InitialsAvatar } from '@/components/domain/avatar';
import { specialtyColor } from '@/lib/specialty-colors';

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
                action={<Button asChild><Link href="/doctors">Find a specialist</Link></Button>}
              />
            </CardContent>
          </Card>
        ) : (
          holds.map((h) => {
            const doc = doctorMap.get(h.practitionerOpenemrId);
            const color = doc ? specialtyColor(doc.specialty) : null;
            return (
              <Card key={h.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <InitialsAvatar
                      name={doc ? `${doc.firstName} ${doc.lastName}` : 'Dr'}
                      gradient={color?.avatar}
                      size={44}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {doc ? `${doc.title} ${doc.firstName} ${doc.lastName}` : 'Specialist'}
                      </p>
                      {doc && color && (
                        <span
                          className={cn(
                            'mt-0.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
                            color.pill,
                          )}
                        >
                          <span className={cn('h-1.5 w-1.5 rounded-full', color.dot)} />
                          {doc.specialty}
                        </span>
                      )}
                    </div>
                    <StatusBadge status={h.status as any} />
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t pt-3 text-sm font-medium tabular-nums">
                    <CalendarPlus className="h-4 w-4 shrink-0 text-primary" />
                    {formatDateTime(h.startAt.toISOString())}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
