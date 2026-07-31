'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, Tags, X } from 'lucide-react';
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
import { cn } from '@/lib/utils';

export type SpecialtyOption = { specialty: string; doctors: number };

const key = (value: string) => value.trim().toLowerCase();

/**
 * Map a department onto the OpenEMR specialty values that belong to it.
 *
 * The list is the vocabulary the live roster actually uses, with a doctor count
 * per value — the count is the point, because a mapping that matches nothing
 * looks identical to a correct one until a patient hits an empty department.
 * Free text is allowed for specialties no current doctor has, so a department
 * can be prepared before the specialist is hired.
 */
export function EditSpecialtiesDialog({
  departmentId,
  departmentName,
  allSpecialties,
  selected: initialSelected,
}: {
  departmentId: string;
  departmentName: string;
  allSpecialties: SpecialtyOption[];
  selected: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setSelected(new Map(initialSelected.map((s) => [key(s), s])));
    setCustom('');
    setError(null);
  }

  function toggle(specialty: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      const k = key(specialty);
      if (next.has(k)) next.delete(k);
      else next.set(k, specialty);
      return next;
    });
  }

  function addCustom() {
    const value = custom.trim();
    if (!value) return;
    setSelected((prev) => new Map(prev).set(key(value), value));
    setCustom('');
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/departments/${departmentId}/specialties`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialties: Array.from(selected.values()) }),
      });
      if (!res.ok) {
        setError('Could not save the mapping.');
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  // Selected values with no matching doctor: either a future hire, or a typo.
  const known = new Set(allSpecialties.map((s) => key(s.specialty)));
  const unmatched = Array.from(selected.entries()).filter(([k]) => !known.has(k));
  const matchedDoctors = allSpecialties
    .filter((s) => selected.has(key(s.specialty)))
    .reduce((sum, s) => sum + s.doctors, 0);

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
          <Tags className="h-4 w-4" /> Map specialties
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Specialties in &ldquo;{departmentName}&rdquo;</DialogTitle>
          <DialogDescription>
            {selected.size === 0
              ? 'Nothing mapped — this department will show no doctors.'
              : `${matchedDoctors} doctor${matchedDoctors === 1 ? '' : 's'} currently match this mapping.`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
          {allSpecialties.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              No active doctors yet, so there are no specialties to choose from. Add one below.
            </p>
          ) : (
            allSpecialties.map((option) => {
              const on = selected.has(key(option.specialty));
              return (
                <button
                  key={option.specialty}
                  type="button"
                  onClick={() => toggle(option.specialty)}
                  aria-pressed={on}
                  className={cn(
                    'flex min-h-[44px] w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                    on ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{option.specialty}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {option.doctors} doctor{option.doctors === 1 ? '' : 's'}
                  </span>
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                    )}
                  >
                    {on && <Check className="h-3 w-3" />}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {unmatched.length > 0 && (
          <div className="rounded-md border border-tint-gold-border bg-tint-gold p-3">
            <p className="text-xs font-semibold text-accent-foreground">
              Mapped but no doctor has it
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {unmatched.map(([k, value]) => (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => toggle(value)}
                    className="inline-flex items-center gap-1 rounded-full border bg-surface px-2 py-1 text-xs"
                  >
                    {value}
                    <X className="h-3 w-3" aria-hidden />
                    <span className="sr-only">Remove {value}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="Add a specialty not in the list"
          />
          <Button type="button" variant="outline" onClick={addCustom} disabled={!custom.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {error && <p className="text-sm text-[#8A2E24]">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
