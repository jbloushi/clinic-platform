'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/domain/status-badge';
import type { Appointment, AppointmentStatus } from '@/lib/data/types';

type Provider = { id: string; name: string; specialty: string };
type Service = { id: string; name: string; durationMinutes: number };
type PatientOpt = { id: string; label: string };

const HOUR_START = 8;
const HOUR_END = 20;
const SLOT_MINUTES = 30;
const ROW_PX = 32; // per 30 minutes

export function CalendarBoard(props: {
  day: string;
  practitioners: Provider[];
  appointments: Appointment[];
  services: Service[];
  patients: PatientOpt[];
}) {
  const router = useRouter();
  const [openNew, setOpenNew] = useState<null | { practitionerId: string; start: string }>(null);
  const [openEdit, setOpenEdit] = useState<Appointment | null>(null);

  const rows = useMemo(() => {
    const items: { hour: number; minute: number; label: string }[] = [];
    for (let h = HOUR_START; h < HOUR_END; h++) {
      items.push({ hour: h, minute: 0, label: fmt(h, 0) });
      items.push({ hour: h, minute: 30, label: fmt(h, 30) });
    }
    return items;
  }, []);

  function goDay(delta: number) {
    const d = new Date(props.day);
    d.setDate(d.getDate() + delta);
    router.push(`/ops/calendar?date=${d.toISOString().slice(0, 10)}`);
  }

  function timeForRow(hour: number, minute: number): string {
    const d = new Date(props.day);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => goDay(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Input
          type="date"
          value={props.day}
          onChange={(e) => router.push(`/ops/calendar?date=${e.target.value}`)}
          className="w-40"
        />
        <Button variant="outline" size="sm" onClick={() => goDay(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/ops/calendar?date=${new Date().toISOString().slice(0, 10)}`)}
        >
          Today
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div
            className="grid border-b bg-muted/40 text-xs font-medium text-muted-foreground"
            style={{ gridTemplateColumns: `72px repeat(${props.practitioners.length}, minmax(180px, 1fr))` }}
          >
            <div className="p-2" />
            {props.practitioners.map((p) => (
              <div key={p.id} className="border-l p-2">
                <div className="truncate font-semibold text-foreground">{p.name}</div>
                <div className="truncate">{p.specialty}</div>
              </div>
            ))}
          </div>
          <div
            className="grid"
            style={{ gridTemplateColumns: `72px repeat(${props.practitioners.length}, minmax(180px, 1fr))` }}
          >
            <div className="border-r">
              {rows.map((r, i) => (
                <div
                  key={i}
                  className="flex items-start justify-end border-b pr-2 pt-1 text-[11px] text-muted-foreground"
                  style={{ height: ROW_PX }}
                >
                  {r.minute === 0 ? r.label : ''}
                </div>
              ))}
            </div>
            {props.practitioners.map((p) => (
              <div key={p.id} className="relative border-l">
                {rows.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => setOpenNew({ practitionerId: p.id, start: timeForRow(r.hour, r.minute) })}
                    className="block w-full border-b hover:bg-primary/5 focus:bg-primary/10 focus:outline-none"
                    style={{ height: ROW_PX }}
                    aria-label={`New appointment at ${r.label}`}
                  />
                ))}
                {props.appointments
                  .filter((a) => a.practitionerId === p.id)
                  .map((a) => {
                    const s = new Date(a.start);
                    const e = new Date(a.end);
                    const top = ((s.getHours() - HOUR_START) * 60 + s.getMinutes()) * (ROW_PX / SLOT_MINUTES);
                    const height = Math.max(28, ((+e - +s) / 60000) * (ROW_PX / SLOT_MINUTES));
                    return (
                      <button
                        key={a.id}
                        onClick={() => setOpenEdit(a)}
                        className="absolute left-1 right-1 rounded-md border border-primary/40 bg-primary/10 p-1.5 text-left text-xs text-foreground shadow-sm hover:bg-primary/15"
                        style={{ top, height }}
                        title={a.reason}
                      >
                        <div className="truncate font-medium">
                          {s.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          {' · '}
                          {a.patientName ?? 'Patient'}
                        </div>
                        <div className="mt-0.5">
                          <StatusBadge status={a.status} />
                        </div>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {openNew && (
        <NewAppointmentDialog
          initial={openNew}
          patients={props.patients}
          services={props.services}
          onClose={() => setOpenNew(null)}
          onDone={() => {
            setOpenNew(null);
            router.refresh();
          }}
        />
      )}
      {openEdit && (
        <EditAppointmentDialog
          appointment={openEdit}
          onClose={() => setOpenEdit(null)}
          onDone={() => {
            setOpenEdit(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function fmt(h: number, m: number): string {
  const ampm = h < 12 ? 'am' : 'pm';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

function NewAppointmentDialog({
  initial,
  patients,
  services,
  onClose,
  onDone,
}: {
  initial: { practitionerId: string; start: string };
  patients: PatientOpt[];
  services: Service[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [patientId, setPatientId] = useState(patients[0]?.id ?? '');
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const svc = services.find((s) => s.id === serviceId);
  const dur = svc?.durationMinutes ?? 20;
  const end = new Date(new Date(initial.start).getTime() + dur * 60_000).toISOString();

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          practitionerId: initial.practitionerId,
          start: initial.start,
          end,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not create');
        return;
      }
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New appointment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Patient</Label>
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {patients.length === 0 && <option value="">(no patients — register one first)</option>}
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Service</Label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.durationMinutes} min)</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Start</Label>
              <Input readOnly value={new Date(initial.start).toLocaleString()} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Consultation" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !patientId}>
            {saving ? 'Saving…' : 'Create appointment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const NEXT_STATUSES: AppointmentStatus[] = ['confirmed', 'checked_in', 'completed', 'no_show', 'cancelled'];

function EditAppointmentDialog({
  appointment,
  onClose,
  onDone,
}: {
  appointment: Appointment;
  onClose: () => void;
  onDone: () => void;
}) {
  const [status, setStatus] = useState<AppointmentStatus>(appointment.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setError('Could not update');
        return;
      }
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Appointment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <div className="text-muted-foreground">Start</div>
            <div className="font-medium">{new Date(appointment.start).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Reason</div>
            <div>{appointment.reason ?? '—'}</div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {NEXT_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Update status'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
