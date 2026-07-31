import Link from 'next/link';
import { MedicalTimeline, type MedicalTimelineEntry } from '@/components/domain/medical-timeline';
import { EmptyState } from '@/components/domain/states';
import { Button } from '@/components/ui/button';
import { requirePatient } from '@/lib/auth/guards';
import { getDataProvider } from '@/lib/data';
import { cn } from '@/lib/utils';
import type { MedicalHistory, Practitioner } from '@/lib/data/types';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Medical records' };

const TABS = [
  { key: 'visits', label: 'Visits' },
  { key: 'prescriptions', label: 'Prescriptions' },
  { key: 'results', label: 'Results' },
  { key: 'documents', label: 'Documents' },
] as const;

type Tab = (typeof TABS)[number]['key'];

/** Document categories that read as a clinical result rather than paperwork. */
const RESULT_CATEGORIES = ['lab', 'labs', 'result', 'results', 'imaging', 'radiology', 'pathology'];

function isResultCategory(category: string): boolean {
  const value = category.trim().toLowerCase();
  return RESULT_CATEGORIES.some((candidate) => value.includes(candidate));
}

const EMPTY_HISTORY: MedicalHistory = {
  problems: [],
  allergies: [],
  medications: [],
  vitals: [],
  documents: [],
};

export default async function MyRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab: Tab = (TABS.find((t) => t.key === tabParam)?.key ?? 'visits') as Tab;

  const patient = await requirePatient();

  if (!patient.openemrPatientUuid) {
    return (
      <div>
        <RecordsHeading />
        <div className="mt-4 rounded-card border bg-surface">
          <EmptyState
            title="Your record starts with your first visit"
            description="Once you have been seen at the clinic, your visits, prescriptions and results will appear here."
            action={
              <Button asChild className="rounded-control">
                <Link href="/doctors">Book your first visit</Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const dp = getDataProvider();
  const [history, encounters] = await Promise.all([
    dp.getPatientMedicalHistory(patient.openemrPatientUuid).catch(() => EMPTY_HISTORY),
    dp.getEncounters({ patientId: patient.openemrPatientUuid }).catch(() => []),
  ]);

  const practitionerIds = Array.from(new Set(encounters.map((e) => e.practitionerId).filter(Boolean)));
  const practitioners = await Promise.all(
    practitionerIds.map((id) => dp.getPractitionerById(id).catch(() => null)),
  );
  const practitionerMap = new Map<string, Practitioner>(
    practitioners.filter((p): p is Practitioner => Boolean(p)).map((p) => [p.id, p]),
  );

  function practitionerName(id: string): string | undefined {
    const practitioner = practitionerMap.get(id);
    return practitioner
      ? `${practitioner.title} ${practitioner.firstName} ${practitioner.lastName}`.trim()
      : undefined;
  }

  // Visits: date, reason and who the patient saw. The encounter note is
  // deliberately excluded — it's the clinician's working record, not a
  // patient-facing summary.
  const visitEntries: MedicalTimelineEntry[] = encounters
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((encounter) => ({
      id: `visit-${encounter.id}`,
      kind: 'visit',
      date: encounter.date,
      title: encounter.reason?.trim() || 'Clinic visit',
      provider: practitionerName(encounter.practitionerId),
    }));

  const prescriptionEntries: MedicalTimelineEntry[] = history.medications
    .slice()
    .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))
    .map((medication, index) => ({
      id: `medication-${index}`,
      kind: 'prescription',
      date: medication.startDate,
      title: medication.name,
      lines: medication.dosage ? [medication.dosage] : undefined,
      badge: medication.active
        ? { label: 'Current', tone: 'teal' }
        : { label: 'Past', tone: 'neutral' },
    }));

  const documents = history.documents.slice().sort((a, b) => b.date.localeCompare(a.date));

  const resultEntries: MedicalTimelineEntry[] = documents
    .filter((document) => isResultCategory(document.category))
    .map((document) => ({
      id: `result-${document.id}`,
      kind: 'result',
      date: document.date,
      title: document.title,
      badge: { label: 'Result ready', tone: 'teal' },
    }));

  const documentEntries: MedicalTimelineEntry[] = documents
    .filter((document) => !isResultCategory(document.category))
    .map((document) => ({
      id: `document-${document.id}`,
      kind: 'document',
      date: document.date,
      title: document.title,
      provider: document.category,
    }));

  const active = {
    visits: {
      entries: visitEntries,
      emptyTitle: 'No visits recorded yet',
      emptyDescription: 'Visits you attend at the clinic will be listed here.',
    },
    prescriptions: {
      entries: prescriptionEntries,
      emptyTitle: 'No prescriptions on file',
      emptyDescription: 'Medications prescribed at the clinic will appear here.',
    },
    results: {
      entries: resultEntries,
      emptyTitle: 'No results yet',
      emptyDescription: 'Lab and imaging results will appear here once they are ready.',
    },
    documents: {
      entries: documentEntries,
      emptyTitle: 'No documents',
      emptyDescription: 'Letters and other documents shared with you will appear here.',
    },
  }[tab];

  return (
    <div>
      <RecordsHeading />

      <nav className="rail mt-3.5 border-b" aria-label="Record sections">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={`/account/records?tab=${item.key}`}
            aria-current={tab === item.key ? 'page' : undefined}
            className={cn(
              'min-h-[44px] shrink-0 whitespace-nowrap border-b-2 pb-3 pt-2 text-[13.5px] transition-colors',
              tab === item.key
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent font-medium text-placeholder hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-4">
        <MedicalTimeline
          entries={active.entries}
          emptyTitle={active.emptyTitle}
          emptyDescription={active.emptyDescription}
        />
      </div>

      <p className="mt-6 text-[11.5px] leading-relaxed text-muted-foreground">
        This is a read-only view. Your clinical record is held in the clinic’s medical record system —
        if something looks wrong or incomplete, please raise it with the clinic.
      </p>
    </div>
  );
}

function RecordsHeading() {
  return <h1 className="font-editorial text-[22px] font-semibold">Medical records</h1>;
}
