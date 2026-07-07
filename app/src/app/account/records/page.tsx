import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/domain/page-header';
import { EmptyState } from '@/components/domain/states';
import { requirePatient } from '@/lib/auth/guards';
import { getDataProvider } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function MyRecordsPage() {
  const patient = await requirePatient();
  if (!patient.openemrPatientUuid) {
    return (
      <div>
        <PageHeader title="My records" />
        <Card className="mt-6">
          <CardContent className="p-0">
            <EmptyState
              title="Book your first visit to start your record"
              description="Once you've had a consultation, your medical history will appear here."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const history = await getDataProvider()
    .getPatientMedicalHistory(patient.openemrPatientUuid)
    .catch(() => ({ problems: [], allergies: [], medications: [], vitals: [], documents: [] }));

  return (
    <div>
      <PageHeader title="My records" description="A read-only view of your medical history." />
      <Tabs defaultValue="problems" className="mt-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="problems">Problems</TabsTrigger>
          <TabsTrigger value="meds">Meds</TabsTrigger>
          <TabsTrigger value="allergies">Allergies</TabsTrigger>
          <TabsTrigger value="documents">Docs</TabsTrigger>
        </TabsList>
        <TabsContent value="problems">
          <ListCard title="Problems" items={history.problems.map((p) => p.label)} />
        </TabsContent>
        <TabsContent value="meds">
          <ListCard title="Medications" items={history.medications.map((m) => `${m.name}${m.dosage ? ' — ' + m.dosage : ''}`)} />
        </TabsContent>
        <TabsContent value="allergies">
          <ListCard title="Allergies" items={history.allergies.map((a) => a.substance)} />
        </TabsContent>
        <TabsContent value="documents">
          <ListCard title="Documents" items={history.documents.map((d) => `${d.title} · ${d.category}`)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader className="py-4"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState title={`No ${title.toLowerCase()} on file`} />
        ) : (
          <ul className="space-y-1 text-sm">
            {items.map((it, i) => <li key={i}>• {it}</li>)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
