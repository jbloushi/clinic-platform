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

type DepartmentRow = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  summaryEn: string;
  summaryAr: string;
};

/**
 * Create or edit a department. One dialog for both, because the fields are
 * identical and the only real difference is whether the URL may move.
 */
export function DepartmentDialog(
  props: { mode: 'create' } | { mode: 'edit'; department: DepartmentRow },
) {
  const router = useRouter();
  const editing = props.mode === 'edit';
  const existing = editing ? props.department : undefined;

  const [open, setOpen] = useState(false);
  const [nameEn, setNameEn] = useState(existing?.nameEn ?? '');
  const [nameAr, setNameAr] = useState(existing?.nameAr ?? '');
  const [summaryEn, setSummaryEn] = useState(existing?.summaryEn ?? '');
  const [summaryAr, setSummaryAr] = useState(existing?.summaryAr ?? '');
  const [regenerateSlug, setRegenerateSlug] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setNameEn(existing?.nameEn ?? '');
    setNameAr(existing?.nameAr ?? '');
    setSummaryEn(existing?.summaryEn ?? '');
    setSummaryAr(existing?.summaryAr ?? '');
    setRegenerateSlug(false);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(editing ? `/api/departments/${existing!.id}` : '/api/departments', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameEn,
          nameAr,
          summaryEn,
          summaryAr,
          ...(editing ? { regenerateSlug } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.error === 'slug_taken'
            ? 'Another department already uses that web address.'
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

  const valid = nameEn.trim() !== '' && nameAr.trim() !== '';

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
            <Plus className="h-4 w-4" /> New department
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${existing!.nameEn}` : 'New department'}</DialogTitle>
          <DialogDescription>
            Shown to patients on the site. Map it to OpenEMR specialties separately — that is what
            decides which doctors appear under it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name (English)" htmlFor="nameEn">
              <Input id="nameEn" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </Field>
            <Field label="Name (Arabic)" htmlFor="nameAr">
              <Input id="nameAr" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
            </Field>
          </div>

          <Field label="Summary (English)" htmlFor="summaryEn">
            <textarea
              id="summaryEn"
              rows={2}
              value={summaryEn}
              onChange={(e) => setSummaryEn(e.target.value)}
              className="w-full rounded-md border bg-background p-2 text-sm"
            />
          </Field>
          <Field label="Summary (Arabic)" htmlFor="summaryAr">
            <textarea
              id="summaryAr"
              dir="rtl"
              rows={2}
              value={summaryAr}
              onChange={(e) => setSummaryAr(e.target.value)}
              className="w-full rounded-md border bg-background p-2 text-sm"
            />
          </Field>

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
                  Currently <code className="rounded bg-muted px-1">/departments/{existing!.slug}</code>.
                  Changing it breaks any existing links.
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
