/** Instantes de timestamps ISO de Postgres o de JS, sin depender de `Date.parse`. */

// Microsegundos y offset opcionales: `Date.parse` de Hermes no garantiza aceptarlos.
const PATRON_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}(?::?\d{2})?)?$/;

const PATRON_OFFSET = /^([+-])(\d{2}):?(\d{2})?$/;

const MS_POR_MINUTO = 60_000;
export const MICROSEGUNDOS_POR_MS = 1000;
const DIGITOS_DE_MICROSEGUNDOS = 6;

function minutosDeOffset(offset: string | undefined): number {
  const partes = offset ? PATRON_OFFSET.exec(offset) : null;
  if (!partes) return 0;
  const [, signo, horas, minutos = '0'] = partes;
  return (signo === '-' ? -1 : 1) * (Number(horas) * 60 + Number(minutos));
}

/** La fracción de segundo en microsegundos: completa con ceros o corta lo que sobra. */
function microsegundosDeFraccion(fraccion: string): number {
  return Number(fraccion.padEnd(DIGITOS_DE_MICROSEGUNDOS, '0').slice(0, DIGITOS_DE_MICROSEGUNDOS));
}

/**
 * Microsegundos desde 1970 en UTC, o null si no es un timestamp. Sin offset se
 * toma como UTC, que es como lo guarda el server.
 */
export function microsegundosDesdeEpoch(iso: string): number | null {
  const partes = PATRON_TIMESTAMP.exec(iso.trim());
  if (!partes) return null;
  const [, anio, mes, dia, hora, minuto, segundo = '0', fraccion = '', offset] = partes;
  const utc = Date.UTC(+anio, +mes - 1, +dia, +hora, +minuto, +segundo);
  const ms = utc - minutosDeOffset(offset) * MS_POR_MINUTO;
  return ms * MICROSEGUNDOS_POR_MS + microsegundosDeFraccion(fraccion);
}
