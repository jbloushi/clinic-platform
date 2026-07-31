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

type BranchRow = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  areaEn: string;
  areaAr: string;
  addressLine: string | null;
  phone: string | null;
  mapUrl: string | null;
};

/** Create or edit a branch's presentation details. Facility linking is separate. */
export function BranchDialog(props: { mode: 'create' } | { mode: 'edit'; branch: BranchRow }) {
  const router = useRouter();
  const editing = props.mode === 'edit';
  const existing = editing ? props.branch : undefined;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nameEn: existing?.nameEn ?? '',
    nameAr: existing?.nameAr ?? '',
    areaEn: existing?.areaEn ?? '',
    areaAr: existing?.areaAr ?? '',
    addressLine: existing?.addressLine ?? '',
    phone: existing?.phone ?? '',
    mapUrl: existing?.mapUrl ?? '',
  });
  const [regenerateSlug, setRegenerateSlug] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function reset() {
    setForm({
      nameEn: existing?.nameEn ?? '',
      nameAr: existing?.nameAr ?? '',
      areaEn: existing?.areaEn ?? '',
      areaAr: existing?.areaAr ?? '',
      addressLine: existing?.addressLine ?? '',
      phone: existing?.phone ?? '',
      mapUrl: existing?.mapUrl ?? '',
    });
    setRegenerateSlug(false);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(editing ? `/api/branches/${existing!.id}` : '/api/branches', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...(editing ? { regenerateSlug } : {}) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.error === 'slug_or_facility_taken'
            ? 'Another branch already uses that web address or facility.'
            : 'Could not save. Check the fields and try again.',
        );
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const valid =
    form.nameEn.trim() && form.nameAr.trim() && form.areaEn.trim() && form.areaAr.trim();

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
            <Plus className="h-4 w-4" /> New branch
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${existing!.nameEn}` : 'New branch'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'How this location appears to patients.'
              : 'Created hidden. Link it to an OpenEMR facility, then publish.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name (English)" htmlFor="b-nameEn">
              <Input id="b-nameEn" value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)} />
            </Field>
            <Field label="Name (Arabic)" htmlFor="b-nameAr">
              <Input id="b-nameAr" dir="rtl" value={form.nameAr} onChange={(e) => set('nameAr', e.target.value)} />
            </Field>
            <Field label="Area (English)" htmlFor="b-areaEn">
              <Input id="b-areaEn" value={form.areaEn} onChange={(e) => set('areaEn', e.target.value)} />
            </Field>
            <Field label="Area (Arabic)" htmlFor="b-areaAr">
              <Input id="b-areaAr" dir="rtl" value={form.areaAr} onChange={(e) => set('areaAr', e.target.value)} />
            </Field>
          </div>

          <Field label="Address" htmlFor="b-address">
            <Input id="b-address" value={form.addressLine} onChange={(e) => set('addressLine', e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="b-phone">
              <Input id="b-phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Map link" htmlFor="b-map">
              <Input id="b-map" value={form.mapUrl} onChange={(e) => set('mapUrl', e.target.value)} />
            </Field>
          </div>

          {editing && (
            <label className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs">
              <input
                type="checkbox"
                checked={regenerateSlug}
                onChange={(e) => setRegenerateSlug(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Update the web address to match the new name.{' '}
                <span className="text-muted-foreground">
                  Currently <code className="rounded bg-muted px-1">/branches/{existing!.slug}</code>.
                </span>
              </span>
            </label>
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

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
