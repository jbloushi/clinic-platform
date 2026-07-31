'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Users } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import type { SpecialistOption } from '../services/edit-specialists-dialog';

/**
 * Assign doctors to a branch.
 *
 * Mirrors the service↔specialist dialog, including its convention: a doctor
 * with no branch assignment anywhere works at every branch. Selecting nobody
 * here therefore removes a restriction rather than emptying the branch, and the
 * description says so — an empty list that silently meant "closed" would be a
 * booking outage nobody would attribute to this screen.
 */
export function EditBranchPractitionersDialog({
  branchId,
  branchName,
  allSpecialists,
  selectedUuids,
}: {
  branchId: string;
  branchName: string;
  allSpecialists: SpecialistOption[];
  selectedUuids: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedUuids));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(uuid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/branches/${branchId}/practitioners`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialistUuids: Array.from(selected) }),
      });
      if (!res.ok) {
        setError('Could not save.');
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSelected(new Set(selectedUuids));
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Users className="h-4 w-4" /> Doctors
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Doctors at &ldquo;{branchName}&rdquo;</DialogTitle>
          <DialogDescription>
            {selected.size === 0
              ? 'Nobody assigned — every doctor without a branch assignment can be booked here.'
              : `${selected.size} doctor${selected.size === 1 ? '' : 's'} assigned to this branch.`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border p-2">
          {allSpecialists.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No active doctors yet.</p>
          ) : (
            allSpecialists.map((sp) => {
              const on = selected.has(sp.uuid);
              return (
                <button
                  key={sp.uuid}
                  type="button"
                  onClick={() => toggle(sp.uuid)}
                  aria-pressed={on}
                  className={cn(
                    'flex min-h-[44px] w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                    on ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{sp.name}</span>{' '}
                    <span className="text-muted-foreground">· {sp.specialty}</span>
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
