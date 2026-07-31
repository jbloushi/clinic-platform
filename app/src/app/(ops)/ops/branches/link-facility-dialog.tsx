'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, Plus } from 'lucide-react';
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

export type FacilityOption = {
  id: string;
  name: string;
  address: string | null;
  active: boolean;
};

/**
 * Point a branch at an OpenEMR facility.
 *
 * This is the link that makes a branch real: appointments booked here are
 * written with that facility's id in `pc_facility`, so the visit shows at the
 * right location in OpenEMR's own calendar. Until it is set, the branch cannot
 * be published.
 *
 * A facility can be created from here because the second one usually doesn't
 * exist yet, and sending an admin into OpenEMR mid-task to make one is a worse
 * handoff than doing it inline.
 */
export function LinkFacilityDialog({
  branchId,
  branchName,
  currentFacilityId,
  facilities,
  takenFacilityIds,
}: {
  branchId: string;
  branchName: string;
  currentFacilityId: string | null;
  facilities: FacilityOption[];
  takenFacilityIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(currentFacilityId);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taken = new Set(takenFacilityIds.filter((id) => id !== currentFacilityId));

  async function createFacility() {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not create the facility in OpenEMR.');
        return;
      }
      // Select it immediately — creating one and then having to find it in the
      // list would be a pointless second step.
      setSelected(String(data.facility.id));
      setCreating(false);
      setNewName('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/branches/${branchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openemrFacilityId: selected ? Number(selected) : null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.error === 'slug_or_facility_taken'
            ? 'Another branch is already linked to that facility.'
            : data.error === 'facility_required_to_publish'
              ? 'This branch is published, so it must stay linked to a facility.'
              : 'Could not save the link.',
        );
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setSelected(currentFacilityId);
          setCreating(false);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Building2 className="h-4 w-4" /> {currentFacilityId ? 'Facility' : 'Link facility'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>OpenEMR facility for &ldquo;{branchName}&rdquo;</DialogTitle>
          <DialogDescription>
            Appointments booked at this branch are recorded against the facility you pick here.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
          {facilities.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              No facilities found in OpenEMR — create one below.
            </p>
          ) : (
            facilities.map((facility) => {
              const isTaken = taken.has(facility.id);
              const on = selected === facility.id;
              return (
                <button
                  key={facility.id}
                  type="button"
                  disabled={isTaken}
                  onClick={() => setSelected(on ? null : facility.id)}
                  aria-pressed={on}
                  className={cn(
                    'flex min-h-[44px] w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                    on && 'bg-primary/10 text-primary',
                    isTaken ? 'cursor-not-allowed opacity-50' : !on && 'hover:bg-accent',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {facility.name}{' '}
                      <span className="font-mono text-xs text-muted-foreground">#{facility.id}</span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {isTaken
                        ? 'Already linked to another branch'
                        : facility.active
                          ? (facility.address ?? 'No address on file')
                          : 'Inactive in OpenEMR'}
                    </span>
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

        {creating ? (
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Facility name in OpenEMR"
              autoFocus
            />
            <Button type="button" onClick={createFacility} disabled={busy || !newName.trim()}>
              {busy ? 'Creating…' : 'Create'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Create a facility in OpenEMR
          </Button>
        )}

        {error && <p className="text-sm text-[#8A2E24]">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
