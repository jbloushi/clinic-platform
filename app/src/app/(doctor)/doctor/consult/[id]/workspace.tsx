'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Lock, Trash2, X } from 'lucide-react';
import { ChartSummaryRail } from '@/components/domain/chart-summary-rail';
import { PatientSafetyHeader } from '@/components/domain/patient-safety-header';
import { ClinicalQuickActions, defaultQuickActions } from '@/components/domain/clinical-quick-actions';
import { cn } from '@/lib/utils';
import type { Appointment, MedicalHistory, Patient } from '@/lib/data/types';

type SoapDraft = {
  chiefComplaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

type Prescription = { drug: string; dosage: string };
type Order = { type: 'lab' | 'imaging' | 'followup'; text: string };

const EMPTY_DRAFT: SoapDraft = {
  chiefComplaint: '',
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
};

/** Local draft key — scoped per appointment so two open charts never collide. */
function draftKey(appointmentId: string): string {
  return `consult-draft:${appointmentId}`;
}

/**
 * Doctor consultation workspace.
 *
 * Three panes on one screen, as the approved design requires: chart summary,
 * the encounter note, and the quick clinical actions. Nothing here navigates
 * away — prescriptions, orders and follow-ups open in place, because losing a
 * half-written note to a page change is the failure this layout exists to
 * prevent.
 *
 * The note autosaves to local storage as a draft and warns before an unload
 * that would discard unsaved work. Signing validates, asks for explicit
 * confirmation, guards against a double submit, and then locks the note.
 */
export function ConsultWorkspace({
  appointment,
  patient,
  history,
  walletBalanceMinor,
  canSeeWallet = false,
  originBookingId,
}: {
  appointment: Appointment;
  patient: Patient | null;
  history: MedicalHistory;
  walletBalanceMinor?: number;
  canSeeWallet?: boolean;
  /** Platform booking behind this visit, so a follow-up can continue the case. */
  originBookingId?: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<SoapDraft>(EMPTY_DRAFT);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [openPanel, setOpenPanel] = useState<'prescription' | 'order' | 'followup' | null>(null);
  const [dirty, setDirty] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(appointment.status === 'completed');
  const [error, setError] = useState<string | null>(null);

  const signInFlight = useRef(false);
  const storageKey = draftKey(appointment.id);

  // Restore any draft left from a previous session before the doctor types.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<SoapDraft>;
      setDraft((current) => ({ ...current, ...parsed }));
    } catch {
      // A corrupt draft is not worth surfacing — start from a clean note.
    }
  }, [storageKey]);

  // Autosave, debounced so typing doesn't hit storage on every keystroke.
  useEffect(() => {
    if (!dirty || signed) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(draft));
        setDraftSavedAt(new Date());
      } catch {
        // Storage unavailable (private mode, quota) — the note stays in memory.
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [draft, dirty, signed, storageKey]);

  // Unsaved-change protection.
  useEffect(() => {
    if (!dirty || signed) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, signed]);

  const update = useCallback((field: keyof SoapDraft, value: string) => {
    setDirty(true);
    setDraft((current) => ({ ...current, [field]: value }));
  }, []);

  /** Required before a note can be signed. */
  const missing = useMemo(() => {
    const gaps: string[] = [];
    if (!draft.chiefComplaint.trim()) gaps.push('Chief complaint');
    if (!draft.assessment.trim()) gaps.push('Assessment');
    if (!draft.plan.trim()) gaps.push('Plan');
    return gaps;
  }, [draft]);

  async function sign() {
    // Belt and braces against a double submit: React state plus a ref, because
    // two fast clicks can both read the pre-update state.
    if (signInFlight.current || signing || signed) return;
    signInFlight.current = true;
    setSigning(true);
    setError(null);

    try {
      const res = await fetch(`/api/consult/${appointment.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: appointment.patientId,
          chiefComplaint: draft.chiefComplaint,
          note: composeNote(draft),
          prescription: prescriptions[0]
            ? { drug: prescriptions[0].drug, dosage: prescriptions[0].dosage }
            : null,
          orders: [
            ...orders,
            // Additional prescriptions ride along as orders so nothing the
            // clinician entered is silently dropped by the single-item API.
            ...prescriptions.slice(1).map((p) => ({
              type: 'prescription',
              text: `${p.drug}${p.dosage ? ` — ${p.dosage}` : ''}`,
            })),
          ],
        }),
      });

      if (!res.ok) {
        setError('The note could not be signed. Nothing was saved — please try again.');
        return;
      }

      setSigned(true);
      setDirty(false);
      setConfirming(false);
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* nothing to clean up */
      }
      router.refresh();
    } catch {
      setError('The note could not be signed. Check your connection and try again.');
    } finally {
      setSigning(false);
      signInFlight.current = false;
    }
  }

  /** The follow-up the clinician asked for, if any — drives the booking prompt. */
  const followUpRequested = orders.find((order) => order.type === 'followup');

  const quickActions = defaultQuickActions({
    onPrescribe: () => setOpenPanel(openPanel === 'prescription' ? null : 'prescription'),
    onOrder: () => setOpenPanel(openPanel === 'order' ? null : 'order'),
    onFollowUp: () => setOpenPanel(openPanel === 'followup' ? null : 'followup'),
    disabled: signed,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PatientSafetyHeader
        patient={patient}
        history={history}
        appointmentStart={appointment.start}
        visitType={appointment.serviceName ?? appointment.reason ?? undefined}
        walletBalanceMinor={walletBalanceMinor}
        canSeeWallet={canSeeWallet}
        action={
          signed ? (
            <span className="inline-flex min-h-[44px] items-center gap-2 rounded-control bg-tint-teal px-4 text-[13.5px] font-semibold text-primary">
              <Lock className="h-4 w-4" aria-hidden />
              Signed
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={signing}
              className="press-scale inline-flex min-h-[44px] items-center rounded-control bg-primary px-5 text-[13.5px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              Finish &amp; sign
            </button>
          )
        }
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="shrink-0 border-b bg-surface-soft p-5 lg:w-[280px] lg:overflow-y-auto lg:border-b-0 lg:border-e">
          <ChartSummaryRail history={history} />
        </aside>

        <div className="min-w-0 flex-1 overflow-y-auto p-5 md:p-6">
          {error && (
            <p
              role="alert"
              className="mb-4 rounded-control border border-[#EBCFCB] bg-[#F7E5E3] px-3 py-2.5 text-[12.5px] text-[#8A2E24]"
            >
              {error}
            </p>
          )}

          <div className="mb-2.5 flex items-baseline justify-between gap-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Encounter note
            </h2>
            <p className="text-[11px] text-muted-foreground" aria-live="polite">
              {signed
                ? 'Signed and locked'
                : draftSavedAt
                  ? `Draft saved ${draftSavedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                  : 'Draft saves automatically'}
            </p>
          </div>

          <div className="space-y-3.5">
            <NoteField
              label="Chief complaint"
              id="chief-complaint"
              required
              rows={2}
              value={draft.chiefComplaint}
              onChange={(value) => update('chiefComplaint', value)}
              disabled={signed}
              placeholder="What brought the patient in today"
            />
            <NoteField
              label="Subjective — history"
              id="subjective"
              rows={4}
              value={draft.subjective}
              onChange={(value) => update('subjective', value)}
              disabled={signed}
              placeholder="History of presenting complaint, relevant background"
            />
            <NoteField
              label="Objective — examination & vitals"
              id="objective"
              rows={4}
              value={draft.objective}
              onChange={(value) => update('objective', value)}
              disabled={signed}
              placeholder="Examination findings, measurements, investigations reviewed"
            />
            <NoteField
              label="Assessment"
              id="assessment"
              required
              rows={3}
              value={draft.assessment}
              onChange={(value) => update('assessment', value)}
              disabled={signed}
              placeholder="Clinical impression"
            />
            <NoteField
              label="Plan"
              id="plan"
              required
              rows={3}
              value={draft.plan}
              onChange={(value) => update('plan', value)}
              disabled={signed}
              placeholder="Treatment, investigations, follow-up"
            />
          </div>

          <h2 className="mb-2.5 mt-6 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Quick actions
          </h2>
          <ClinicalQuickActions actions={quickActions} />

          {openPanel === 'prescription' && (
            <Panel title="Add prescription" onClose={() => setOpenPanel(null)}>
              <TwoFieldForm
                firstLabel="Medication"
                firstPlaceholder="e.g. Omeprazole 20 mg"
                secondLabel="Directions"
                secondPlaceholder="e.g. once daily for 14 days"
                submitLabel="Add prescription"
                onSubmit={(drug, dosage) => {
                  setPrescriptions((current) => [...current, { drug, dosage }]);
                  setDirty(true);
                  setOpenPanel(null);
                }}
              />
            </Panel>
          )}

          {openPanel === 'order' && (
            <Panel title="Order investigation" onClose={() => setOpenPanel(null)}>
              <OrderForm
                onSubmit={(type, text) => {
                  setOrders((current) => [...current, { type, text }]);
                  setDirty(true);
                  setOpenPanel(null);
                }}
              />
            </Panel>
          )}

          {openPanel === 'followup' && (
            <Panel title="Request follow-up" onClose={() => setOpenPanel(null)}>
              <SingleFieldForm
                label="When should the patient be seen again?"
                placeholder="e.g. 2 weeks, after bloodwork"
                submitLabel="Add follow-up"
                onSubmit={(text) => {
                  setOrders((current) => [...current, { type: 'followup', text }]);
                  setDirty(true);
                  setOpenPanel(null);
                }}
              />
              <p className="mt-2.5 text-[11.5px] text-muted-foreground">
                This records the follow-up interval on the encounter. Once the note is signed you
                can book the appointment from here, or reception can book it later.
              </p>
            </Panel>
          )}

          {/* Booking only becomes available once the note is signed: the
              follow-up is part of the plan, and offering to schedule it while
              the assessment is still being written invites booking a visit for
              a decision that hasn't been made. */}
          {signed && followUpRequested && originBookingId && (
            <div className="mt-5 rounded-md border border-tint-gold-border bg-tint-gold p-4">
              <h3 className="text-[13px] font-semibold text-accent-foreground">
                Follow-up requested
              </h3>
              <p className="mt-1 text-[12px] leading-relaxed text-accent-foreground/90">
                {followUpRequested.text} — book it now and it will be linked to today&apos;s visit.
              </p>
              <Link
                href={`/doctors/${encodeURIComponent(
                  appointment.practitionerId,
                )}?followUpFrom=${encodeURIComponent(originBookingId)}#booking`}
                className="press-scale mt-3 inline-flex min-h-[44px] items-center rounded-control bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Book the follow-up
              </Link>
            </div>
          )}

          {(prescriptions.length > 0 || orders.length > 0) && (
            <div className="mt-5 rounded-md border bg-surface p-4">
              <h3 className="mb-2.5 text-[12px] font-semibold">Added this visit</h3>
              <ul className="space-y-1.5">
                {prescriptions.map((prescription, index) => (
                  <AddedRow
                    key={`rx-${index}`}
                    label="Prescription"
                    text={`${prescription.drug}${prescription.dosage ? ` — ${prescription.dosage}` : ''}`}
                    onRemove={
                      signed
                        ? undefined
                        : () =>
                            setPrescriptions((current) => current.filter((_, i) => i !== index))
                    }
                  />
                ))}
                {orders.map((order, index) => (
                  <AddedRow
                    key={`order-${index}`}
                    label={order.type === 'followup' ? 'Follow-up' : order.type}
                    text={order.text}
                    onRemove={
                      signed ? undefined : () => setOrders((current) => current.filter((_, i) => i !== index))
                    }
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {confirming && (
        <ConfirmSign
          missing={missing}
          signing={signing}
          prescriptionCount={prescriptions.length}
          orderCount={orders.length}
          onCancel={() => setConfirming(false)}
          onConfirm={sign}
        />
      )}
    </div>
  );
}

/** SOAP sections joined into the single note string the sign API accepts. */
function composeNote(draft: SoapDraft): string {
  return [
    draft.subjective && `S: ${draft.subjective.trim()}`,
    draft.objective && `O: ${draft.objective.trim()}`,
    draft.assessment && `A: ${draft.assessment.trim()}`,
    draft.plan && `P: ${draft.plan.trim()}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function NoteField({
  label,
  id,
  value,
  onChange,
  rows,
  required,
  disabled,
  placeholder,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-semibold text-foreground/80">
        {label}
        {required && (
          <span className="ms-1 text-[#B0603F]" aria-label="required">
            *
          </span>
        )}
      </label>
      <textarea
        id={id}
        rows={rows}
        required={required}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border bg-surface p-3 text-[13.5px] leading-relaxed disabled:bg-muted disabled:text-muted-foreground"
      />
    </div>
  );
}

function Panel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-3.5 rounded-md border border-primary/30 bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${title}`}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {children}
    </section>
  );
}

function TwoFieldForm({
  firstLabel,
  firstPlaceholder,
  secondLabel,
  secondPlaceholder,
  submitLabel,
  onSubmit,
}: {
  firstLabel: string;
  firstPlaceholder: string;
  secondLabel: string;
  secondPlaceholder: string;
  submitLabel: string;
  onSubmit: (first: string, second: string) => void;
}) {
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!first.trim()) return;
        onSubmit(first.trim(), second.trim());
        setFirst('');
        setSecond('');
      }}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label={firstLabel} value={first} onChange={setFirst} placeholder={firstPlaceholder} required />
        <TextInput label={secondLabel} value={second} onChange={setSecond} placeholder={secondPlaceholder} />
      </div>
      <SubmitRow label={submitLabel} disabled={!first.trim()} />
    </form>
  );
}

function OrderForm({ onSubmit }: { onSubmit: (type: 'lab' | 'imaging', text: string) => void }) {
  const [type, setType] = useState<'lab' | 'imaging'>('lab');
  const [text, setText] = useState('');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!text.trim()) return;
        onSubmit(type, text.trim());
        setText('');
      }}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <div>
          <label htmlFor="order-type" className="mb-1.5 block text-[12px] font-semibold text-foreground/80">
            Type
          </label>
          <select
            id="order-type"
            value={type}
            onChange={(event) => setType(event.target.value as 'lab' | 'imaging')}
            className="h-[42px] w-full rounded-md border bg-surface px-2.5 text-[13px]"
          >
            <option value="lab">Lab</option>
            <option value="imaging">Imaging</option>
          </select>
        </div>
        <TextInput
          label="Investigation"
          value={text}
          onChange={setText}
          placeholder="e.g. Full blood count"
          required
        />
      </div>
      <SubmitRow label="Add order" disabled={!text.trim()} />
    </form>
  );
}

function SingleFieldForm({
  label,
  placeholder,
  submitLabel,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  submitLabel: string;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!value.trim()) return;
        onSubmit(value.trim());
        setValue('');
      }}
      className="space-y-3"
    >
      <TextInput label={label} value={value} onChange={setValue} placeholder={placeholder} required />
      <SubmitRow label={submitLabel} disabled={!value.trim()} />
    </form>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, '-');
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-semibold text-foreground/80">
        {label}
      </label>
      <input
        id={id}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-[42px] w-full rounded-md border bg-surface px-3 text-[13px]"
      />
    </div>
  );
}

function SubmitRow({ label, disabled }: { label: string; disabled: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="press-scale inline-flex min-h-[42px] items-center rounded-control bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function AddedRow({
  label,
  text,
  onRemove,
}: {
  label: string;
  text: string;
  onRemove?: () => void;
}) {
  return (
    <li className="flex items-center gap-2.5 rounded-md border bg-background px-3 py-2 text-[12.5px]">
      <span className="shrink-0 rounded-full bg-tint-teal px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-primary">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate">{text}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label.toLowerCase()}: ${text}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </li>
  );
}

function ConfirmSign({
  missing,
  signing,
  prescriptionCount,
  orderCount,
  onCancel,
  onConfirm,
}: {
  missing: string[];
  signing: boolean;
  prescriptionCount: number;
  orderCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const blocked = missing.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-sign-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
    >
      <div className="w-full max-w-md rounded-card border bg-surface p-5 shadow-xl">
        <h2 id="confirm-sign-title" className="font-editorial text-[19px] font-semibold">
          {blocked ? 'The note isn’t complete' : 'Sign this encounter?'}
        </h2>

        {blocked ? (
          <>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              These sections are required before signing:
            </p>
            <ul className="mt-2 list-inside list-disc text-[13px] font-medium">
              {missing.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Signing records the note against this appointment and locks it from further editing.
            {prescriptionCount > 0 || orderCount > 0
              ? ` ${prescriptionCount} prescription${prescriptionCount === 1 ? '' : 's'} and ${orderCount} order${orderCount === 1 ? '' : 's'} will be recorded with it.`
              : ''}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="press-scale min-h-[44px] rounded-control border bg-surface px-4 text-[13.5px] font-semibold"
          >
            {blocked ? 'Back to note' : 'Cancel'}
          </button>
          {!blocked && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={signing}
              className={cn(
                'press-scale inline-flex min-h-[44px] items-center gap-2 rounded-control bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60',
              )}
            >
              {signing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Signing…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" aria-hidden />
                  Sign and lock
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
