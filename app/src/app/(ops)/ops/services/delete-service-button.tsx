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
 * Retire a service.
 *
 * The server deactivates rather than deletes once any booking references it —
 * bookings carry a serviceId with no foreign key behind it, and reschedule
 * reads the service back for its duration, so removing the row would strand
 * them. The dialog says which of the two will happen only after the fact,
 * because the count lives server-side.
 */
export function DeleteServiceButton({
  serviceId,
  serviceName,
}: {
  serviceId: string;
  serviceName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/services/${serviceId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError('Could not remove this service.');
        return;
      }
      if (data.deactivated) {
        setOutcome(
          `Deactivated instead of deleted — ${data.bookings} booking${data.bookings === 1 ? '' : 's'} still reference it.`,
        );
        router.refresh();
        return;
      }
      setOpen(false);
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
          setError(null);
          setOutcome(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label={`Remove ${serviceName}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove &ldquo;{serviceName}&rdquo;?</DialogTitle>
          <DialogDescription>
            If any appointment has ever been booked for it, the service is deactivated instead of
            deleted so that history stays readable. Otherwise it is removed entirely.
          </DialogDescription>
        </DialogHeader>

        {outcome && <p className="text-sm font-medium">{outcome}</p>}
        {error && <p className="text-sm text-[#8A2E24]">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {outcome ? 'Close' : 'Keep it'}
          </Button>
          {!outcome && (
            <Button type="button" onClick={confirm} disabled={busy}>
              {busy ? 'Removing…' : 'Remove'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
