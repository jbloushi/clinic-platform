import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/domain/page-header';
import { EmptyState } from '@/components/domain/states';
import { getDataProvider } from '@/lib/data';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DoctorPatientChartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dp = getDataProvider();
  const [patient, history, encounters] = await Promise.all([
    dp.getPatientById(id),
    dp.getPatientMedicalHistory(id).catch(() => ({ problems: [], allergies: [], medications: [], vitals: [], documents: [] })),
    dp.getEncounters({ patientId: id }).catch(() => []),
  ]);
  if (!patient) notFound();

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/doctor/schedule"><ChevronLeft className="h-4 w-4" /> Back to schedule</Link>
      </Button>
      <PageHeader
        title={`${patient.firstName} ${patient.lastName}`}
        description={`${patient.dateOfBirth ?? 'DOB unknown'} · ${patient.sex ?? 'unknown'}`}
      />

      <Tabs defaultValue="chart">
        <TabsList>
          <TabsTrigger value="chart">Chart</TabsTrigger>
          <TabsTrigger value="encounters">Encounters</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="chart" className="space-y-4">
          <ChartCard title="Problems / diagnoses">
            {history.problems.length === 0 ? (
              <EmptyState title="No active problems" />
            ) : (
              <ul className="divide-y">
                {history.problems.map((p, i) => (
                  <li key={i} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      {p.label}
                      {p.code && <span className="ml-2 text-xs text-muted-foreground">({p.code})</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">{p.onsetDate ? formatDate(p.onsetDate) : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
          <ChartCard title="Allergies">
            {history.allergies.length === 0 ? (
              <EmptyState title="No known allergies" />
            ) : (
              <ul className="divide-y">
                {history.allergies.map((a, i) => (
                  <li key={i} className="py-2 text-sm">
                    <span className="font-medium">{a.substance}</span>
                    {a.reaction && <span className="ml-2 text-muted-foreground">— {a.reaction}</span>}
                    {a.severity && <span className="ml-2 text-xs text-muted-foreground">({a.severity})</span>}
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
          <ChartCard title="Medications">
            {history.medications.length === 0 ? (
              <EmptyState title="No current medications" />
            ) : (
              <ul className="divide-y">
                {history.medications.map((m, i) => (
                  <li key={i} className="py-2 text-sm">
                    <span className="font-medium">{m.name}</span>
                    {m.dosage && <span className="ml-2 text-muted-foreground">— {m.dosage}</span>}
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
        </TabsContent>

        <TabsContent value="encounters">
          <Card>
            <CardContent className="p-0">
              {encounters.length === 0 ? (
                <EmptyState title="No prior encounters" />
              ) : (
                <ul className="divide-y">
                  {encounters.map((e) => (
                    <li key={e.id} className="p-4">
                      <div className="text-sm font-medium">{e.date ? formatDate(e.date) : ''}</div>
                      <div className="text-sm text-muted-foreground">{e.reason ?? 'Encounter'}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardContent className="p-0">
              {history.documents.length === 0 ? (
                <EmptyState title="No documents on file" />
              ) : (
                <ul className="divide-y">
                  {history.documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between p-4 text-sm">
                      <span className="font-medium">{d.title}</span>
                      <span className="text-xs text-muted-foreground">{d.category} · {d.date ? formatDate(d.date) : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="py-4">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
