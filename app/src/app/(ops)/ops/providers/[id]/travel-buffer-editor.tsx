'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function TravelBufferEditor({
  providerId,
  clinicDefault,
  initialOverride,
}: {
  providerId: string;
  /** AssignmentSettings.crossBranchBufferMinutes, for the "use default" copy. */
  clinicDefault: number;
  /** PractitionerTravelBuffer.bufferMinutes for this doctor, or null if no override exists. */
  initialOverride: number | null;
}) {
  const router = useRouter();
  const [useOverride, setUseOverride] = useState(initialOverride !== null);
  const [minutes, setMinutes] = useState(initialOverride ?? clinicDefault);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/providers/${providerId}/travel-buffer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bufferMinutes: useOverride ? minutes : null }),
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
    <div className="space-y-3">
      <p className="text-[12.5px] text-muted-foreground">
        Minimum gap required between this doctor&apos;s appointments at two different branches — never
        applied within the same branch.
      </p>
      <label className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
        <input
          type="checkbox"
          checked={useOverride}
          onChange={(e) => setUseOverride(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Override the clinic default ({clinicDefault} min)
        </span>
      </label>
      {useOverride && (
        <div className="grid gap-1.5 sm:max-w-[220px]">
          <Label htmlFor="travelBufferMinutes">Buffer for this doctor (minutes)</Label>
          <Input
            id="travelBufferMinutes"
            type="number"
            min={0}
            max={240}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {saved && <span className="text-sm text-emerald-700">Saved.</span>}
      </div>
    </div>
  );
}
