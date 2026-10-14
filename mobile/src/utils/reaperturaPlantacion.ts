/**
 * Reabrir una plantación finalizada (#470, #637): quién puede, cuándo se ofrece y
 * qué dice la confirmación. Mismos textos que la web.
 */
import { ROL } from '../constants/roles';
import { esArchivada, esEliminadaEnServidor, esFinalizada } from '../constants/estados';
import type { EstadoDeEdicionDePlantacion } from './permisosDeEdicion';

export const ETIQUETA_REABRIR = 'Reabrir plantación';

export const AYUDA_REABRIR_SIN_CONEXION = 'Reabrir requiere conexión a internet';

/** Espeja el guard del RPC; el server rechaza igual si se fuerza. */
export function puedeReabrir(rol: string | null | undefined): boolean {
  return rol === ROL.superadmin;
}

/** Una archivada no se reabre: desarchivarla es una decisión aparte. */
export function esReabrible(plantacion: EstadoDeEdicionDePlantacion): boolean {
  return esFinalizada(plantacion) && !esArchivada(plantacion) && !esEliminadaEnServidor(plantacion);
}

export const CONFIRMACION_REAPERTURA = {
  titulo: (lugar: string) => `¿Reabrir ${lugar}?`,
  descripcion: (lugar: string) =>
    `${lugar} vuelve a estar activa: la app acepta registros de nuevo y el trabajo ` +
    'que quedó sin sincronizar se puede subir.',
  aviso: 'Los grupos ya finalizados siguen finalizados. Podés volver a finalizarla cuando quieras.',
  etiqueta: 'Reabrir',
};

export function mensajeConfirmacionReapertura(lugar: string): string {
  return `${CONFIRMACION_REAPERTURA.descripcion(lugar)}\n\n${CONFIRMACION_REAPERTURA.aviso}`;
}
