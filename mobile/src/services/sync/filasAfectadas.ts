/**
 * PostgREST no da error cuando un update no matchea ninguna fila: la fila no existe
 * en el server o RLS la oculta (p.ej. plantación finalizada). Leído como éxito, se
 * limpia el pendiente local y el dato se pierde en silencio (#482).
 *
 * Por eso esos updates piden las filas (`.select('id')`) y chequean con esto.
 */
export function sinFilasAfectadas(filas: readonly unknown[] | null | undefined): boolean {
  return !filas || filas.length === 0;
}

/** Causa para el log: el pendiente se conserva y se reintenta en el próximo sync. */
export const DETALLE_SIN_FILAS_AFECTADAS =
  'el update no afectó filas (no existe en el server o RLS la oculta); queda pendiente';
