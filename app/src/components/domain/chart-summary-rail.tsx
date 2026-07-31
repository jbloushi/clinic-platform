import { cn } from '@/lib/utils';
import type { MedicalHistory } from '@/lib/data/types';

/**
 * Left chart rail for the consultation workspace: allergies, problems,
 * medications and the latest vitals, always visible beside the note so the
 * clinician never navigates away to check them.
 *
 * Allergies lead and carry the alert tint — they're the one card here that is a
 * safety signal rather than reference.
 */
export function ChartSummaryRail({
  history,
  className,
}: {
  history: MedicalHistory;
  className?: string;
}) {
  const activeProblems = history.problems.filter((p) => p.active);
  const activeMeds = history.medications.filter((m) => m.active);
  const latestVitals = [...history.vitals].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )[0];

  const bmi = bodyMassIndex(latestVitals?.weightKg, latestVitals?.heightCm);

  return (
    <div className={cn('space-y-3', className)}>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Chart summary
      </h2>

      <RailCard title="Allergies" tone="alert">
        {history.allergies.length === 0 ? (
          <Placeholder>No known allergies recorded</Placeholder>
        ) : (
          <ul className="space-y-0.5">
            {history.allergies.map((allergy, i) => (
              <li key={i}>
                {allergy.substance}
                {allergy.reaction ? (
                  <span className="text-muted-foreground"> — {allergy.reaction}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </RailCard>

      <RailCard title="Problems">
        {activeProblems.length === 0 ? (
          <Placeholder>None active</Placeholder>
        ) : (
          <ul className="space-y-0.5">
            {activeProblems.map((problem, i) => (
              <li key={i}>{problem.label}</li>
            ))}
          </ul>
        )}
      </RailCard>

      <RailCard title="Medications">
        {activeMeds.length === 0 ? (
          <Placeholder>None active</Placeholder>
        ) : (
          <ul className="space-y-0.5">
            {activeMeds.map((med, i) => (
              <li key={i}>
                {med.name}
                {med.dosage ? <span className="text-muted-foreground"> {med.dosage}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </RailCard>

      <RailCard title="Latest vitals">
        {!latestVitals ? (
          <Placeholder>No vitals recorded</Placeholder>
        ) : (
          <dl className="space-y-1">
            <Vital label="Weight" value={latestVitals.weightKg ? `${latestVitals.weightKg} kg` : null} />
            <Vital label="BMI" value={bmi} />
            <Vital
              label="BP"
              value={
                latestVitals.systolic && latestVitals.diastolic
                  ? `${latestVitals.systolic}/${latestVitals.diastolic}`
                  : null
              }
            />
            <Vital label="Pulse" value={latestVitals.pulse ? `${latestVitals.pulse} bpm` : null} />
          </dl>
        )}
      </RailCard>
    </div>
  );
}

function RailCard({
  title,
  tone = 'default',
  children,
}: {
  title: string;
  tone?: 'default' | 'alert';
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border bg-surface p-3.5">
      <h3
        className={cn(
          'mb-1.5 text-[12px] font-semibold',
          tone === 'alert' ? 'text-[#B0603F]' : 'text-foreground',
        )}
      >
        {title}
      </h3>
      <div className="text-[12.5px] leading-relaxed text-foreground/80">{children}</div>
    </section>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>;
}

function Vital({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * BMI from the recorded vitals. Derived here rather than stored because it's a
 * pure restatement of weight and height — not a new clinical assertion.
 */
function bodyMassIndex(weightKg?: number, heightCm?: number): string | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const metres = heightCm / 100;
  return (weightKg / (metres * metres)).toFixed(1);
}
