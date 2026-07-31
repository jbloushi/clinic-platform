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
 * Delete a department, after saying what else it affects.
 *
 * Services under it are not deleted — they lose their grouping and keep working
 * — but ops can't see that from the row, so the confirmation states it.
 */
export function DeleteDepartmentButton({
  departmentId,
  departmentName,
}: {
  departmentId: string;
  departmentName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/departments/${departmentId}`, { method: 'DELETE' });
      if (!res.ok) {
        setError('Could not delete this department.');
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
        <Button size="sm" variant="ghost" aria-label={`Delete ${departmentName}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{departmentName}&rdquo;?</DialogTitle>
          <DialogDescription>
            Its specialty mapping is removed. Services in this department are kept but become
            uncategorised, and any link to /departments/… stops working.
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
