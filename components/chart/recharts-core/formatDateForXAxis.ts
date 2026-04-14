// Ported (minimally) from chartCore-src `recharts-adapter.ts`.
// Converts leading 4-digit year to 2-digit except when the whole string is a year.

export function formatDateForXAxis(dateDisplay: string): string {
  if (!dateDisplay) return dateDisplay;

  // Keep "2026" style year labels as-is.
  if (/^\d{4}$/.test(dateDisplay)) return dateDisplay;

  // For "2026-01" / "2026-01-23" etc, shrink year to "26-...".
  return dateDisplay.replace(/^(\d{4})/, (match) => match.slice(2));
}
