/**
 * Fechas de calendario, sin hora: YYYY-MM-DD en la base, DD/MM/AAAA en pantalla.
 * Se convierten con componentes locales: toISOString pasa a UTC y en Argentina
 * corre la fecha un día para atrás.
 */

const PATRON_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

function dos(valor: number): string {
  return String(valor).padStart(2, '0');
}

/** '2026-04-15' (o un timestamp que empiece así) → '2026-04-15'; '' si no es una fecha. */
export function recortarIso(iso: string | null | undefined): string {
  const match = iso ? PATRON_ISO.exec(iso) : null;
  return match ? match[0] : '';
}

/** '2026-04-15' → '15/04/2026'. */
export function isoAFecha(iso: string | null | undefined): string {
  const match = iso ? PATRON_ISO.exec(iso) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

/** '2026-04-15' → 15/04/2026 a las 00:00 locales; null si no es una fecha. */
export function isoADate(iso: string): Date | null {
  const match = PATRON_ISO.exec(iso);
  if (!match) return null;
  const [, anio, mes, dia] = match;
  return new Date(Number(anio), Number(mes) - 1, Number(dia));
}

/** Date → '2026-04-15', con el día que ve el usuario. */
export function dateAIso(fecha: Date): string {
  const anio = String(fecha.getFullYear()).padStart(4, '0');
  return `${anio}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}
