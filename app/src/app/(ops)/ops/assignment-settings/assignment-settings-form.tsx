'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Settings = {
  preferPreviousPractitioner: boolean;
  workloadWindowDays: number;
  useLeastRecentlyAssigned: boolean;
  allowBackupTier: boolean;
  holdDurationMinutes: number;
  slotSearchWindowDays: number;
  slotQuantumMinutes: number;
  showDoctorNameBeforePayment: boolean;
};

export function AssignmentSettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/assignment-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        setError('Could not save. Check the fields and try again.');
        return;
      }
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Auto-assignment ranking
        </h3>
        <div className="space-y-2">
          <Toggle
            label="Prefer the patient's previous doctor for follow-ups"
            checked={form.preferPreviousPractitioner}
            onChange={(v) => setForm((p) => ({ ...p, preferPreviousPractitioner: v }))}
          />
          <Toggle
            label="Break ties by least-recently-assigned (rotation)"
            checked={form.useLeastRecentlyAssigned}
            onChange={(v) => setForm((p) => ({ ...p, useLeastRecentlyAssigned: v }))}
          />
          <Toggle
            label="Allow backup-tier doctors when no preferred/normal doctor is eligible"
            checked={form.allowBackupTier}
            onChange={(v) => setForm((p) => ({ ...p, allowBackupTier: v }))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Workload comparison window (days)"
            htmlFor="workloadWindowDays"
            hint="How far back confirmed bookings are counted when ranking by current load."
          >
            <Input
              id="workloadWindowDays"
              type="number"
              min={1}
              max={365}
              value={form.workloadWindowDays}
              onChange={(e) => setForm((p) => ({ ...p, workloadWindowDays: Number(e.target.value) }))}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-3 border-t pt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Reservation
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Hold duration (minutes)"
            htmlFor="holdDurationMinutes"
            hint="How long a reserved slot stays locked before it's released automatically."
          >
            <Input
              id="holdDurationMinutes"
              type="number"
              min={1}
              max={180}
              value={form.holdDurationMinutes}
              onChange={(e) => setForm((p) => ({ ...p, holdDurationMinutes: Number(e.target.value) }))}
            />
          </Field>
          <Field
            label="Slot search window (days)"
            htmlFor="slotSearchWindowDays"
            hint="How far ahead availability is searched by default."
          >
            <Input
              id="slotSearchWindowDays"
              type="number"
              min={1}
              max={180}
              value={form.slotSearchWindowDays}
              onChange={(e) => setForm((p) => ({ ...p, slotSearchWindowDays: Number(e.target.value) }))}
            />
          </Field>
          <Field
            label="Overlap-lock quantum (minutes)"
            htmlFor="slotQuantumMinutes"
            hint="Granularity of the buckets that prevent two holds from overlapping. Smaller is more precise but writes more lock rows per hold."
          >
            <Input
              id="slotQuantumMinutes"
              type="number"
              min={1}
              max={60}
              value={form.slotQuantumMinutes}
              onChange={(e) => setForm((p) => ({ ...p, slotQuantumMinutes: Number(e.target.value) }))}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-3 border-t pt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Patient experience
        </h3>
        <Toggle
          label="Show the auto-assigned doctor's name before payment"
          checked={form.showDoctorNameBeforePayment}
          onChange={(v) => setForm((p) => ({ ...p, showDoctorNameBeforePayment: v }))}
        />
      </section>

      {error && <p className="text-sm text-[#8A2E24]">{error}</p>}

      <div className="flex items-center gap-3 border-t pt-5">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        {saved && <span className="text-sm text-emerald-700">Saved.</span>}
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-[11.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" />
      <span>{label}</span>
    </label>
  );
}
