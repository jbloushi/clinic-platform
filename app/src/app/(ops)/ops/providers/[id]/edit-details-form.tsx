'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SPECIALTIES } from '@/lib/specialties';
import type { Practitioner } from '@/lib/data/types';

const ROLES = [
  { value: '', label: 'Not set' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'technician', label: 'Technician' },
];

export function EditDetailsForm({ practitioner }: { practitioner: Practitioner }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState(practitioner.firstName);
  const [lastName, setLastName] = useState(practitioner.lastName);
  const [title, setTitle] = useState(practitioner.title);
  const [specialty, setSpecialty] = useState(practitioner.specialty);
  const [role, setRole] = useState(practitioner.role ?? '');
  const [npi, setNpi] = useState('');
  const [bio, setBio] = useState(practitioner.bio ?? '');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/providers/${practitioner.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          title,
          specialty,
          role: role || undefined,
          npi: npi || undefined,
          bio: bio || undefined,
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
          <Label htmlFor="fn">First name</Label>
          <Input id="fn" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ln">Last name</Label>
          <Input id="ln" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="specialty">Specialty</Label>
          <select
            id="specialty"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {SPECIALTIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger id="role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2 sm:max-w-xs">
        <Label htmlFor="npi">NPI</Label>
        <Input id="npi" placeholder="Leave blank to keep current" value={npi} onChange={(e) => setNpi(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
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
