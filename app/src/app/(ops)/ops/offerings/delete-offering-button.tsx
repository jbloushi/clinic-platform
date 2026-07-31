'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
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

/**
 * Delete an offering, or deactivate it if a booking already references it —
 * matches `deletePractitionerOffering`'s own soft-delete behavior exactly.
 */
export function DeleteOfferingButton({ offeringId, label }: { offeringId: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ deactivated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/offerings/${offeringId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError('Could not remove this offering.');
        return;
      }
      setResult({ deactivated: data.deactivated });
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
          setResult(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label={`Remove ${label}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove &ldquo;{label}&rdquo;?</DialogTitle>
          {!result && (
            <DialogDescription>
              If a booking already used this offering, it&apos;s deactivated instead of deleted — the
              appointment record needs it to stay readable.
            </DialogDescription>
          )}
        </DialogHeader>

        {result && (
          <p className="text-sm text-muted-foreground">
            {result.deactivated
              ? 'A past booking referenced this offering, so it was deactivated rather than deleted.'
              : 'Removed.'}
          </p>
        )}
        {error && <p className="text-sm text-[#8A2E24]">{error}</p>}

        <DialogFooter>
          {result ? (
            <Button type="button" onClick={() => setOpen(false)}>
              Close
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Keep it
              </Button>
              <Button type="button" onClick={confirm} disabled={busy}>
                {busy ? 'Removing…' : 'Remove'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
