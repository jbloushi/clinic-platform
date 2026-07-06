'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AvailabilityRule } from '@/lib/data/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AvailabilityEditor({ providerId, initial }: { providerId: string; initial: AvailabilityRule[] }) {
  const router = useRouter();
  const [rules, setRules] = useState<AvailabilityRule[]>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function update(i: number, patch: Partial<AvailabilityRule>) {
    setRules((r) => r.map((row, ix) => (ix === i ? { ...row, ...patch } : row)));
  }
  function remove(i: number) {
    setRules((r) => r.filter((_, ix) => ix !== i));
  }
  function add() {
    setRules((r) => [...r, { dayOfWeek: 1, startTime: '09:00', endTime: '13:00', slotMinutes: 20 }]);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/providers/${providerId}/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {rules.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No availability yet. Add at least one block per week.
          </p>
        )}
        {rules.map((r, i) => (
          <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-md border p-3 sm:grid-cols-5">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Day</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={r.dayOfWeek}
                onChange={(e) => update(i, { dayOfWeek: Number(e.target.value) as 0 | 1 | 2 | 3 | 4 | 5 | 6 })}
              >
                {DAYS.map((d, ix) => (
                  <option key={ix} value={ix}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Start</label>
              <Input type="time" value={r.startTime} onChange={(e) => update(i, { startTime: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">End</label>
              <Input type="time" value={r.endTime} onChange={(e) => update(i, { endTime: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Slot (min)</label>
              <Input
                type="number"
                min={5}
                max={120}
                value={r.slotMinutes}
                onChange={(e) => update(i, { slotMinutes: Number(e.target.value) })}
                className="h-9"
              />
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={add}>
          <Plus className="h-4 w-4" /> Add block
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save availability'}
        </Button>
        {saved && <span className="text-sm text-emerald-700">Saved.</span>}
      </div>
    </div>
  );
}
