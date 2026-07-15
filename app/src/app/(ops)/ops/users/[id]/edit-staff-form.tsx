'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ROLES = ['reception', 'doctor', 'admin', 'finance'] as const;

export type PractitionerOption = { id: string; name: string };

export function EditStaffForm({
  staffId,
  initialRole,
  initialOpenemrUserId,
  practitionerOptions,
}: {
  staffId: string;
  initialRole: string;
  initialOpenemrUserId: string | null;
  practitionerOptions: PractitionerOption[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState(initialRole);
  const [openemrUserId, setOpenemrUserId] = useState(initialOpenemrUserId ?? '');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          openemrUserId: role === 'doctor' ? openemrUserId || null : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not save changes');
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger id="role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r} className="capitalize">
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {role === 'doctor' && (
          <div className="space-y-2">
            <Label htmlFor="specialist">Linked specialist</Label>
            <Select value={openemrUserId || '__none'} onValueChange={(v) => setOpenemrUserId(v === '__none' ? '' : v)}>
              <SelectTrigger id="specialist">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Not linked</SelectItem>
                {practitionerOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
