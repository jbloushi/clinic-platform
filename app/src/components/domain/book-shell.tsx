import { PatientShell } from './patient-shell';

/**
 * Chrome for the booking journey — the entry choices, the service/slot pickers,
 * and the details form.
 *
 * Booking is one funnel, so it reads as a single screen changing rather than
 * three different pages: the same back affordance in the same place, the same
 * measure, the same header. This is now `PatientShell`'s focused variant, which
 * also keeps the patient's bottom navigation present throughout — the funnel
 * used to render no navigation at all.
 */
export function BookShell({
  backHref,
  backLabel = 'Back',
  title,
  description,
  children,
}: {
  backHref: string;
  backLabel?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <PatientShell
      variant="focused"
      backHref={backHref}
      backLabel={backLabel}
      title={title}
      description={description}
    >
      {children}
    </PatientShell>
  );
}
