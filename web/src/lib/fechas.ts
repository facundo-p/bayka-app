/** Formatea una fecha ISO como fecha corta es-AR, ej. "12/06/2026". */
export function formatearFechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
