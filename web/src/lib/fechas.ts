/** Formatea una fecha ISO como fecha corta es-AR, ej. "12/06/2026". */
export function formatearFechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formatea un mes 'YYYY-MM' como etiqueta es-AR amigable, ej. "jun 2026".
 * Ancla la fecha al día 1 en UTC para que el huso horario no corra el mes.
 */
export function formatearMes(mes: string): string {
  const [anio, mesNumero] = mes.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mesNumero - 1, 1));
  return fecha.toLocaleDateString('es-AR', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const FORMATO_DIA = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/**
 * Formatea una fecha ISO como día con mes abreviado, ej. "18 abr 2025".
 * Se arma por partes porque es-AR las une con "de" ("18 de abr de 2025") y el
 * punto del mes abreviado varía según la versión de ICU.
 */
export function formatearFechaDia(iso: string): string {
  const partes = FORMATO_DIA.formatToParts(new Date(iso));
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value.replace('.', '') ?? '';
  return `${parte('day')} ${parte('month')} ${parte('year')}`;
}
