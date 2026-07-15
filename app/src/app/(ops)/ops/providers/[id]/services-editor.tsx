'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ServiceOption = { id: string; name: string };

/**
 * Multi-select of services this specialist is eligible for. Empty selection
 * means "not explicitly linked to any service" — the specialist is still
 * eligible for any service that itself has zero assigned specialists (the
 * "any active specialist" fallback from Phase 2), just not for services that
 * have their own explicit list.
 */
export function ServicesEditor({
  practitionerId,
  allServices,
  selectedIds,
}: {
  practitionerId: string;
  allServices: ServiceOption[];
  selectedIds: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/providers/${practitionerId}/services`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceIds: Array.from(selected) }),
      });
      if (!res.ok) {
        setError('Could not save');
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
        {allServices.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No services configured yet.</p>
        ) : (
          allServices.map((svc) => {
            const on = selected.has(svc.id);
            return (
              <button
                key={svc.id}
                type="button"
                onClick={() => toggle(svc.id)}
                aria-pressed={on}
                className={cn(
                  'flex w-full min-h-[44px] items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                  on ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
                )}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{svc.name}</span>
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
      <Button type="button" size="sm" onClick={onSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save services'}
      </Button>
    </div>
  );
}
