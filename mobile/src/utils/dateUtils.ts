/** Formatea un epoch ms como ISO-like en zona horaria local: YYYY-MM-DDTHH:MM:SS (sin sufijo Z). */
export function localIsoFromMs(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Timestamp actual en zona local (ISO-like, sin Z); usado en createdAt para que los filtros de "hoy" funcionen bien. */
export function localNow(): string {
  return localIsoFromMs(Date.now());
}

/** Returns today's date as YYYY-MM-DD in local timezone. */
export function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
