export function normalizeMobile(v: string): string {
  return v.replace(/[^\d+]/g, '');
}
