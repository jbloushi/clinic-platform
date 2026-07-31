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
 * Delete a branch. Refused by the server while any booking references it —
 * where a patient was seen is a fact about that visit, not something to erase.
 */
export function DeleteBranchButton({
  branchId,
  branchName,
}: {
  branchId: string;
  branchName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/branches/${branchId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error === 'has_bookings'
            ? `${data.bookings} booking${data.bookings === 1 ? '' : 's'} reference this branch, so it can't be deleted. Hide it instead.`
            : 'Could not delete this branch.',
        );
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label={`Delete ${branchName}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{branchName}&rdquo;?</DialogTitle>
          <DialogDescription>
            Doctor assignments for this branch are removed. The OpenEMR facility itself is left
            alone — only the link to it goes.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-[#8A2E24]">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Keep it
          </Button>
          <Button type="button" onClick={confirm} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
