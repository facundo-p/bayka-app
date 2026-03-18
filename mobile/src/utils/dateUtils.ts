/**
 * Returns current timestamp in local timezone as ISO-like string.
 * Format: YYYY-MM-DDTHH:MM:SS (no Z suffix — local time)
 * Used for createdAt fields so "today" filters work correctly.
 */
export function localNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Returns today's date as YYYY-MM-DD in local timezone.
 */
export function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
