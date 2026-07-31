/**
 * Shape of the in-progress /book/v2 selection as it travels through the URL.
 *
 * Everything here is safe to put in a query string — a branch slug, a service
 * id, a chosen time. `holdId` deliberately isn't a field on this type: once a
 * hold exists it lives in the URL of the steps that need it (details, review),
 * but it is never something earlier steps construct or guess at, and there is
 * nothing here worth keeping server-side only for privacy — none of it is a
 * secret, just state that would otherwise vanish on refresh.
 */
export type BookingEntryPath = 'SERVICE_PATH' | 'DOCTOR_PATH';

export type BookingSelection = {
  branchSlug: string;
  serviceId?: string;
  specialistOpenemrUuid?: string;
  start?: string;
  end?: string;
};

/** Build a query string from whichever fields are set, dropping the rest. */
export function selectionToParams(selection: Partial<BookingSelection>): URLSearchParams {
  const params = new URLSearchParams();
  if (selection.branchSlug) params.set('branch', selection.branchSlug);
  if (selection.serviceId) params.set('service', selection.serviceId);
  if (selection.specialistOpenemrUuid) params.set('practitioner', selection.specialistOpenemrUuid);
  if (selection.start) params.set('start', selection.start);
  if (selection.end) params.set('end', selection.end);
  return params;
}
