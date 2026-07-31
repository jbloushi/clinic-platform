'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Cancel / reschedule footer for a patient's own appointment.
 *
 * Cancelling asks for confirmation inline rather than in a dialog: the question
 * belongs to this one card, and a modal would hide which visit is being called
 * off. Reschedule navigates to the specialist's calendar with the booking in
 * tow — the slot picker is the same one used for a first booking, so there's
 * one place where times get chosen.
 */
export function AppointmentActions({
  bookingId,
  rescheduleHref,
}: {
  bookingId: string;
  rescheduleHref?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.error === 'already_started'
            ? 'This visit has already started — please call the clinic.'
            : 'We could not cancel this visit. Please try again or contact the clinic.',
        );
        return;
      }
      // Say so locally straight away. router.refresh() re-renders the server
      // component that owns this card, but that round-trip is slow enough that
      // the row would otherwise still read "Confirmed" after the patient
      // cancelled it — the one moment they most need to be sure it worked.
      setCancelled(true);
      setConfirming(false);
      router.refresh();
    } catch {
      setError('We could not reach the clinic. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (cancelled) {
    return (
      <p className="px-4 py-3.5 text-[13px] font-semibold text-muted-foreground">
        Cancelled. The time has been released.
      </p>
    );
  }

  if (confirming) {
    return (
      <div className="p-[15px]">
        <p className="text-[13px] font-semibold">Cancel this appointment?</p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          The time is released for other patients. You can book again, but this slot may be taken.
        </p>
        {error && (
          <p role="alert" className="mt-2.5 text-[12px] font-medium text-[#8A2E24]">
            {error}
          </p>
        )}
        <div className="mt-3 flex gap-2.5">
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              setError(null);
            }}
            disabled={busy}
            className="press-scale flex min-h-[44px] flex-1 items-center justify-center rounded-control border bg-surface px-4 text-[13px] font-semibold disabled:opacity-60"
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="press-scale flex min-h-[44px] flex-1 items-center justify-center rounded-control bg-[#8A2E24] px-4 text-[13px] font-semibold text-white hover:bg-[#7a2820] disabled:opacity-60"
          >
            {busy ? 'Cancelling…' : 'Yes, cancel'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      {rescheduleHref && (
        <Link
          href={rescheduleHref}
          className={cn(
            'flex min-h-[48px] flex-1 items-center justify-center px-3 text-[13px] font-semibold text-primary hover:bg-tint-teal',
            'border-e border-muted',
          )}
        >
          Reschedule
        </Link>
      )}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex min-h-[48px] flex-1 items-center justify-center px-3 text-[13px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        Cancel
      </button>
    </div>
  );
}
