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

export type SpecialistOption = { uuid: string; name: string; specialty: string };

/**
 * Multi-select of specialists eligible for a service. Empty selection means
 * "any active specialist" (enforced server-side in setServiceSpecialists /
 * the booking-time eligibility fallback) — the dialog surfaces that plainly
 * so ops don't think an empty list means "nobody."
 */
export function EditSpecialistsDialog({
  serviceId,
  serviceName,
  allSpecialists,
  selectedUuids,
}: {
  serviceId: string;
  serviceName: string;
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

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/services/${serviceId}/specialists`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialistUuids: Array.from(selected) }),
      });
      if (!res.ok) {
        setError('Could not save');
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
          <Users className="h-4 w-4" /> Assign specialists
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Specialists for &ldquo;{serviceName}&rdquo;</DialogTitle>
          <DialogDescription>
            {selected.size === 0
              ? 'No one selected — any active specialist can be auto-assigned to this service.'
              : `${selected.size} specialist${selected.size === 1 ? '' : 's'} selected — only they are eligible for this service.`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border p-2">
          {allSpecialists.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No active specialists yet.</p>
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
                    'flex w-full min-h-[44px] items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
