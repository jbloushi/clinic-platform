'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Doctor consultation workspace. Note + orders (mock in P1 — writes to
 * AuditLog with structured metadata so the info survives page refreshes).
 */
export function ConsultWorkspace({ appointmentId, patientId }: { appointmentId: string; patientId: string }) {
  const router = useRouter();
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [note, setNote] = useState('');
  const [rxDrug, setRxDrug] = useState('');
  const [rxDosage, setRxDosage] = useState('');
  const [orders, setOrders] = useState<{ type: string; text: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [signed, setSigned] = useState(false);

  function addOrder(type: 'lab' | 'imaging') {
    const text = prompt(type === 'lab' ? 'Lab test' : 'Imaging study');
    if (text) setOrders((o) => [...o, { type, text }]);
  }

  async function sign() {
    setSaving(true);
    try {
      const res = await fetch(`/api/consult/${appointmentId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          chiefComplaint,
          note,
          prescription: rxDrug ? { drug: rxDrug, dosage: rxDosage } : null,
          orders,
        }),
      });
      if (res.ok) {
        setSigned(true);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-4"><CardTitle className="text-base">Encounter note</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cc">Chief complaint</Label>
            <Input id="cc" value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Clinical note</Label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={8}
              className="w-full rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="History of present illness, exam, assessment, plan…"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-4"><CardTitle className="text-base">Prescription</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Drug</Label>
            <Input value={rxDrug} onChange={(e) => setRxDrug(e.target.value)} placeholder="Amoxicillin 500 mg" />
          </div>
          <div className="space-y-2">
            <Label>Dosage</Label>
            <Input value={rxDosage} onChange={(e) => setRxDosage(e.target.value)} placeholder="1 tab tid × 7 days" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Orders</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => addOrder('lab')}>+ Lab</Button>
            <Button size="sm" variant="outline" onClick={() => addOrder('imaging')}>+ Imaging</Button>
          </div>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {orders.map((o, i) => (
                <li key={i} className="flex items-center justify-between rounded-md border p-2">
                  <span><span className="font-medium uppercase">{o.type}</span> — {o.text}</span>
                  <Button variant="ghost" size="sm" onClick={() => setOrders(orders.filter((_, ix) => ix !== i))}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        {signed && <span className="text-sm text-emerald-700 flex items-center gap-1"><Check className="h-4 w-4" /> Signed</span>}
        <Button onClick={sign} disabled={saving}>{saving ? 'Signing…' : 'Sign encounter'}</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Note: encounter and prescription writes are recorded locally in this phase. Phase 3 will
        push them to OpenEMR via the encounter/prescription API (or a custom module).
      </p>
    </div>
  );
}
