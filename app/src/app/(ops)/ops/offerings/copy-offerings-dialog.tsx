'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy } from 'lucide-react';
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
import { Label } from '@/components/ui/label';

type BranchOption = { id: string; name: string };

/**
 * Copy one branch's offerings onto another. Price/duration overrides never
 * travel — a Hawally price is a statement about Hawally — and anything whose
 * prerequisites don't hold at the target (doctor not assigned there, service
 * not offered there) is reported rather than silently skipped or invented.
 */
export function CopyOfferingsDialog({ branches }: { branches: BranchOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fromBranchId, setFromBranchId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: { offeringId: string; reasons: string[] }[] } | null>(null);

  function reset() {
    setFromBranchId('');
    setToBranchId('');
    setError(null);
    setResult(null);
  }

  async function run(dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/offerings/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromBranchId, toBranchId, dryRun }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error === 'same_branch' ? 'Pick two different branches.' : 'Could not copy offerings.');
        return;
      }
      setResult({ created: data.created, skipped: data.skipped });
      if (!dryRun) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const valid = fromBranchId && toBranchId && fromBranchId !== toBranchId;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Copy className="h-4 w-4" /> Copy between branches
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy offerings</DialogTitle>
          <DialogDescription>
            Preview first — anything the target branch isn&apos;t ready for (doctor not assigned there,
            service not offered there) is listed, not guessed at.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="copy-from">From branch</Label>
              <select
                id="copy-from"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={fromBranchId}
                onChange={(e) => {
                  setFromBranchId(e.target.value);
                  setResult(null);
                }}
              >
                <option value="">Select…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="copy-to">To branch</Label>
              <select
                id="copy-to"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={toBranchId}
                onChange={(e) => {
                  setToBranchId(e.target.value);
                  setResult(null);
                }}
              >
                <option value="">Select…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {result && (
            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              <p className="font-medium">
                {result.created} offering{result.created === 1 ? '' : 's'} would be created.
              </p>
              {result.skipped.length > 0 && (
                <>
                  <p className="mt-2 font-medium text-[#8A2E24]">{result.skipped.length} skipped:</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                    {result.skipped.map((s) => (
                      <li key={s.offeringId}>{s.reasons.join(', ')}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          {error && <p className="text-sm text-[#8A2E24]">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button type="button" variant="outline" onClick={() => run(true)} disabled={!valid || busy}>
            Preview
          </Button>
          <Button type="button" onClick={() => run(false)} disabled={!valid || busy}>
            {busy ? 'Copying…' : 'Copy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
