import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amountMinor: number, currency = 'KWD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amountMinor / 100);
}

/**
 * Patient-facing price. The design shows prices as "KD 30" rather than the
 * accounting form ("KWD 30.000"), and trims trailing zeros so a round fee reads
 * as a round number. Uses the same minor-unit convention as `formatCurrency`
 * so both render the same stored value.
 *
 * Staff/billing screens should keep `formatCurrency` — the explicit ISO code
 * matters there.
 */
const PRICE_SYMBOL: Record<string, string> = { KWD: 'KD' };

export function formatPrice(amountMinor: number, currency = 'KWD'): string {
  const major = amountMinor / 100;
  const decimals = Number.isInteger(major) ? 0 : 2;
  const amount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: 2,
  }).format(major);
  return `${PRICE_SYMBOL[currency] ?? currency} ${amount}`;
}

/**
 * Masks an identifier for display, keeping only the leading characters:
 * "290010112345" → "29··········". Used for Civil ID and any other sensitive
 * value that appears in a summary — clinicians confirm the prefix without the
 * full number being on screen or in a screenshot.
 */
export function maskIdentifier(value: string | null | undefined, visible = 2): string {
  if (!value) return '—';
  const trimmed = value.trim();
  if (trimmed.length <= visible) return '·'.repeat(trimmed.length);
  return trimmed.slice(0, visible) + '·'.repeat(Math.min(10, trimmed.length - visible));
}

/** Whole years between a date of birth and today. */
export function ageFrom(dateOfBirth: string | null | undefined, now = new Date()): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age >= 0 && age < 140 ? age : null;
}

/** Relative day label for appointment cards: "Today", "In 2 days", "3 days ago". */
export function formatRelativeDay(iso: string, now = new Date()): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1) return `In ${days} days`;
  return `${Math.abs(days)} days ago`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}
