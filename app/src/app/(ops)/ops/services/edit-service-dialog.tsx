'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
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

type ServiceRow = {
  id: string;
  slug: string;
  name: string;
  nameAr: string | null;
  summaryEn: string | null;
  summaryAr: string | null;
  departmentId: string | null;
  durationMinutes: number;
  priceMinor: number;
  publishedOnWeb: boolean;
};

/**
 * Edit a service.
 *
 * This is the one catalogue now: the same row drives booking (duration, price,
 * eligibility) and the public site (Arabic name, summary, department). The
 * "show on website" switch is what separates an internal visit type like
 * "Procedure (in-clinic)" from something a patient should browse.
 */
export function EditServiceDialog({
  service,
  departments,
}: {
  service: ServiceRow;
  departments: { id: string; nameEn: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: service.name,
    nameAr: service.nameAr ?? '',
    summaryEn: service.summaryEn ?? '',
    summaryAr: service.summaryAr ?? '',
    departmentId: service.departmentId ?? '',
    durationMinutes: String(service.durationMinutes),
    price: (service.priceMinor / 1000).toFixed(3),
    publishedOnWeb: service.publishedOnWeb,
  });
  const [regenerateSlug, setRegenerateSlug] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setForm({
      name: service.name,
      nameAr: service.nameAr ?? '',
      summaryEn: service.summaryEn ?? '',
      summaryAr: service.summaryAr ?? '',
      departmentId: service.departmentId ?? '',
      durationMinutes: String(service.durationMinutes),
      price: (service.priceMinor / 1000).toFixed(3),
      publishedOnWeb: service.publishedOnWeb,
    });
    setRegenerateSlug(false);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          nameAr: form.nameAr || null,
          summaryEn: form.summaryEn || null,
          summaryAr: form.summaryAr || null,
          departmentId: form.departmentId || null,
          durationMinutes: Number(form.durationMinutes),
          // Prices are entered in dinars and stored in fils.
          priceMinor: Math.round(Number(form.price) * 1000),
          publishedOnWeb: form.publishedOnWeb,
          regenerateSlug,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.error === 'slug_taken'
            ? 'Another service already uses that web address.'
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
    form.name.trim() !== '' &&
    Number(form.durationMinutes) >= 5 &&
    Number.isFinite(Number(form.price)) &&
    Number(form.price) >= 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {service.name}</DialogTitle>
          <DialogDescription>
            Used by booking and, when published, by the public services page.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name (English)" htmlFor="s-name">
              <Input
                id="s-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
            <Field label="Name (Arabic)" htmlFor="s-nameAr">
              <Input
                id="s-nameAr"
                dir="rtl"
                value={form.nameAr}
                onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
              />
            </Field>
          </div>

          <Field label="Department" htmlFor="s-dept">
            <select
              id="s-dept"
              value={form.departmentId}
              onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Uncategorised</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nameEn}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Duration (minutes)" htmlFor="s-duration">
              <Input
                id="s-duration"
                type="number"
                min={5}
                max={240}
                value={form.durationMinutes}
                onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
              />
            </Field>
            <Field label="Fee (KWD)" htmlFor="s-price">
              <Input
                id="s-price"
                type="number"
                min={0}
                step="0.001"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </Field>
          </div>

          <Field label="Summary (English)" htmlFor="s-sumEn">
            <textarea
              id="s-sumEn"
              rows={2}
              value={form.summaryEn}
              onChange={(e) => setForm((f) => ({ ...f, summaryEn: e.target.value }))}
              className="w-full rounded-md border bg-background p-2 text-sm"
            />
          </Field>
          <Field label="Summary (Arabic)" htmlFor="s-sumAr">
            <textarea
              id="s-sumAr"
              dir="rtl"
              rows={2}
              value={form.summaryAr}
              onChange={(e) => setForm((f) => ({ ...f, summaryAr: e.target.value }))}
              className="w-full rounded-md border bg-background p-2 text-sm"
            />
          </Field>

          <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              checked={form.publishedOnWeb}
              onChange={(e) => setForm((f) => ({ ...f, publishedOnWeb: e.target.checked }))}
              className="mt-0.5"
            />
            <span>
              Show on the public services page
              <span className="block text-xs text-muted-foreground">
                Separate from booking — a service can be bookable without being listed publicly.
              </span>
            </span>
          </label>

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
                Currently <code className="rounded bg-muted px-1">/services/{service.slug}</code>.
                Changing it breaks existing links.
              </span>
            </span>
          </label>

          {error && <p className="text-sm text-[#8A2E24]">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving || !valid}>
            {saving ? 'Saving…' : 'Save changes'}
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
