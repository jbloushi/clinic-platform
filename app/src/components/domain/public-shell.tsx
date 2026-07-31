/**
 * Compatibility surface for the patient site chrome.
 *
 * `PublicShell` is now `PatientShell`'s default variant — the rename matters
 * because the shell also carries the bottom navigation, which every page using
 * this import previously lacked on mobile. Re-exported rather than duplicated so
 * there is one implementation.
 */
export { PatientShell as PublicShell, PatientShell } from './patient-shell';
export { PublicFooter, PublicHeader } from './public-nav';
