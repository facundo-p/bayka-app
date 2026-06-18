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
