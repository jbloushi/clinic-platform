'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Option = { id: string; name: string };

type OfferingRow = {
  id: string;
  specialistOpenemrUuid: string;
  active: boolean;
  publishedOnWeb: boolean;
  allowAutoAssignment: boolean;
  allowPatientChoice: boolean;
  assignmentPriority: number;
  assignmentPriorityTier: 'PREFERRED' | 'NORMAL' | 'BACKUP';
  durationMinutes: number | null;
  priceMinor: number | null;
  service: { name: string };
  department: { nameEn: string };
  branch: { nameEn: string };
};

const MUTABLE_DEFAULTS = {
  active: true,
  publishedOnWeb: true,
  allowAutoAssignment: true,
  allowPatientChoice: true,
  assignmentPriority: 100,
  assignmentPriorityTier: 'NORMAL' as const,
  durationMinutes: '' as string | number,
  priceMinor: '' as string | number,
};

/**
 * Create or edit an offering.
 *
 * Who/what/where (doctor, service, department, branch) can only be set at
 * creation — `updatePractitionerOffering` never touches those fields (see
 * offering-repo.ts). Changing which doctor an offering is about is a new
 * offering, not an edit of the old one; the edit form only ever shows the
 * mutable fields (priority, eligibility, overrides, publication state).
 */
export function OfferingDialog(
  props:
    | { mode: 'create'; specialists: SpecialistOption[]; services: Option[]; departments: Option[]; branches: Option[] }
    | { mode: 'edit'; offering: OfferingRow },
) {
  const router = useRouter();
  const editing = props.mode === 'edit';
  const existing = editing ? props.offering : undefined;

  const [open, setOpen] = useState(false);
  const [identity, setIdentity] = useState({ specialistOpenemrUuid: '', serviceId: '', departmentId: '', branchId: '' });
  const [form, setForm] = useState(() => mutableFromExisting(existing));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[] | null>(null);

  function reset() {
    setIdentity({ specialistOpenemrUuid: '', serviceId: '', departmentId: '', branchId: '' });
    setForm(mutableFromExisting(existing));
    setError(null);
    setMissing(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMissing(null);
    try {
      const payload = editing
        ? {
            active: form.active,
            publishedOnWeb: form.publishedOnWeb,
            allowAutoAssignment: form.allowAutoAssignment,
            allowPatientChoice: form.allowPatientChoice,
            assignmentPriority: Number(form.assignmentPriority),
            assignmentPriorityTier: form.assignmentPriorityTier,
            durationMinutes: form.durationMinutes === '' ? null : Number(form.durationMinutes),
            priceMinor: form.priceMinor === '' ? null : Number(form.priceMinor),
          }
        : {
            ...identity,
            active: form.active,
            publishedOnWeb: form.publishedOnWeb,
            allowAutoAssignment: form.allowAutoAssignment,
            allowPatientChoice: form.allowPatientChoice,
            assignmentPriority: Number(form.assignmentPriority),
            assignmentPriorityTier: form.assignmentPriorityTier,
            durationMinutes: form.durationMinutes === '' ? null : Number(form.durationMinutes),
            priceMinor: form.priceMinor === '' ? null : Number(form.priceMinor),
          };

      const res = await fetch(editing ? `/api/offerings/${existing!.id}` : '/api/offerings', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === 'missing_prerequisites') {
          setMissing(data.missing);
        } else if (data.error === 'offering_already_exists') {
          setError('This doctor already offers this service under this department at this branch.');
        } else {
          setError('Could not save. Check the fields and try again.');
        }
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const valid = editing || (identity.specialistOpenemrUuid && identity.serviceId && identity.departmentId && identity.branchId);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger asChild>
        {editing ? (
          <Button size="sm" variant="ghost">
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="h-4 w-4" /> New offering
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit offering` : 'New offering'}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? `${existing!.service.name} · ${existing!.department.nameEn} · ${existing!.branch.nameEn}`
              : 'The doctor must already be assigned to the branch, and the service must already be offered there and in that department — this states the combination, it does not create those relationships.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[65vh] gap-4 overflow-y-auto">
          {!editing && props.mode === 'create' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Doctor" htmlFor="o-doctor">
                <select
                  id="o-doctor"
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={identity.specialistOpenemrUuid}
                  onChange={(e) => setIdentity((p) => ({ ...p, specialistOpenemrUuid: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {props.specialists.map((s) => (
                    <option key={s.uuid} value={s.uuid}>
                      {s.name} — {s.specialty}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Branch" htmlFor="o-branch">
                <select
                  id="o-branch"
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={identity.branchId}
                  onChange={(e) => setIdentity((p) => ({ ...p, branchId: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {props.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Service" htmlFor="o-service">
                <select
                  id="o-service"
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={identity.serviceId}
                  onChange={(e) => setIdentity((p) => ({ ...p, serviceId: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {props.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Department" htmlFor="o-department">
                <select
                  id="o-department"
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={identity.departmentId}
                  onChange={(e) => setIdentity((p) => ({ ...p, departmentId: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {props.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Priority tier" htmlFor="o-tier">
              <select
                id="o-tier"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={form.assignmentPriorityTier}
                onChange={(e) => setForm((p) => ({ ...p, assignmentPriorityTier: e.target.value as typeof p.assignmentPriorityTier }))}
              >
                <option value="PREFERRED">Preferred</option>
                <option value="NORMAL">Normal</option>
                <option value="BACKUP">Backup</option>
              </select>
            </Field>
            <Field label="Priority (lower first)" htmlFor="o-priority">
              <Input
                id="o-priority"
                type="number"
                value={form.assignmentPriority}
                onChange={(e) => setForm((p) => ({ ...p, assignmentPriority: Number(e.target.value) }))}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Duration override (min)" htmlFor="o-duration">
              <Input
                id="o-duration"
                type="number"
                placeholder="Inherit from branch/service"
                value={form.durationMinutes}
                onChange={(e) => setForm((p) => ({ ...p, durationMinutes: e.target.value }))}
              />
            </Field>
            <Field label="Price override (fils)" htmlFor="o-price">
              <Input
                id="o-price"
                type="number"
                placeholder="Inherit from branch/service"
                value={form.priceMinor}
                onChange={(e) => setForm((p) => ({ ...p, priceMinor: e.target.value }))}
              />
            </Field>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Toggle
              label="Allow auto-assignment"
              hint="The engine may pick this doctor unprompted."
              checked={form.allowAutoAssignment}
              onChange={(v) => setForm((p) => ({ ...p, allowAutoAssignment: v }))}
            />
            <Toggle
              label="Allow patient choice"
              hint="A patient may pick this doctor by name."
              checked={form.allowPatientChoice}
              onChange={(v) => setForm((p) => ({ ...p, allowPatientChoice: v }))}
            />
            <Toggle
              label="Active"
              hint="Off retires it without deleting history."
              checked={form.active}
              onChange={(v) => setForm((p) => ({ ...p, active: v }))}
            />
            <Toggle
              label="Published on web"
              hint="Off hides it from patients while staying active internally."
              checked={form.publishedOnWeb}
              onChange={(v) => setForm((p) => ({ ...p, publishedOnWeb: v }))}
            />
          </div>

          {missing && (
            <div className="rounded-md border border-[#EBCFCB] bg-[#F7E5E3] p-3 text-xs text-[#8A2E24]">
              <p className="font-semibold">Missing prerequisites:</p>
              <ul className="mt-1 list-disc pl-4">
                {missing.map((m) => (
                  <li key={m}>{MISSING_LABEL[m] ?? m}</li>
                ))}
              </ul>
            </div>
          )}
          {error && <p className="text-sm text-[#8A2E24]">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving || !valid}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function mutableFromExisting(existing?: OfferingRow) {
  if (!existing) return { ...MUTABLE_DEFAULTS };
  return {
    active: existing.active,
    publishedOnWeb: existing.publishedOnWeb,
    allowAutoAssignment: existing.allowAutoAssignment,
    allowPatientChoice: existing.allowPatientChoice,
    assignmentPriority: existing.assignmentPriority,
    assignmentPriorityTier: existing.assignmentPriorityTier,
    durationMinutes: existing.durationMinutes ?? '',
    priceMinor: existing.priceMinor ?? '',
  };
}

const MISSING_LABEL: Record<string, string> = {
  service_not_offered_at_branch: 'This service is not offered at this branch (add it in /ops/branches or /ops/services).',
  service_not_in_department: 'This service is not linked to this department.',
  practitioner_not_assigned_to_branch: 'This doctor is not assigned to this branch (add them in /ops/branches).',
};

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" />
      <span>
        <span className="block font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

// Re-exported type shape expected from the shared specialist option — kept
// local to avoid a circular import back into the services ops directory.
type SpecialistOption = { uuid: string; name: string; specialty: string };
