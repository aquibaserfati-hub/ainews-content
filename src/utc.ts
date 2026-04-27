// UTC date helpers — strict ISO-8601 with no fractional seconds.
// Matches the contract pinned in src/schema.ts and the iOS DateFormatter.

/**
 * Format a Date as strict UTC ISO-8601 with no fractional seconds.
 * E.g. `2026-04-27T15:09:37Z`. NEVER includes milliseconds.
 */
export function formatUtcIso8601(date: Date): string {
  const iso = date.toISOString(); // 2026-04-27T15:09:37.123Z
  // Drop the .NNN before the Z.
  return iso.replace(/\.\d{3}Z$/, "Z");
}

/**
 * Current UTC time formatted to the contract.
 */
export function nowUtcIso8601(): string {
  return formatUtcIso8601(new Date());
}

/**
 * Monday 00:00:00 UTC of the current week, formatted to the contract.
 * Used for `weekOf` in the digest.
 */
export function currentWeekOfUtcIso8601(now: Date = new Date()): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  // getUTCDay: Sunday=0, Monday=1, ..., Saturday=6. We want Monday.
  const day = d.getUTCDay();
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offsetToMonday);
  return formatUtcIso8601(d);
}
