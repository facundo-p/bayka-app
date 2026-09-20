/**
 * Reabrir una plantación finalizada (#470): quién puede, cuándo se ofrece y qué
 * dice la confirmación. Puro: se testea sin renderizar.
 *
 * Existe por el técnico que termina un grupo sin señal: el admin finaliza sin
 * verlo y el push del técnico queda rechazado, con su trabajo atrapado en el
 * celular. Reabrir es la válvula, y va donde hay control: el superadmin.
 */
import { esArchivada, ESTADO_PLANTACION, type Plantacion } from '../../queries/plantationQueries';
import { reabrirPlantacion } from '../../repositories/plantationRepository';
import { ROL, type Perfil } from '../../repositories/profileRepository';

export const ETIQUETA_MENU_REABRIR = 'Reabrir plantación';

/** Espeja el guard del RPC; el server rechaza igual si se fuerza. */
export function puedeReabrir(perfil: Pick<Perfil, 'rol' | 'activo'> | null): boolean {
  return perfil !== null && perfil.activo && perfil.rol === ROL.SUPERADMIN;
}

/** Una archivada no se reabre: desarchivarla es una decisión aparte. */
export function esReabrible(plantacion: Pick<Plantacion, 'estado' | 'archivadaEn'>): boolean {
  return plantacion.estado === ESTADO_PLANTACION.finalizada && !esArchivada(plantacion);
}

export const CONFIRMACION_REAPERTURA = {
  titulo: (lugar: string) => `¿Reabrir ${lugar}?`,
  descripcion: (lugar: string) =>
    `${lugar} vuelve a estar activa: la app acepta registros de nuevo y el trabajo ` +
    'que quedó sin sincronizar se puede subir.',
  aviso: 'Los grupos ya finalizados siguen finalizados. Podés volver a finalizarla cuando quieras.',
  etiqueta: 'Reabrir',
  servicio: reabrirPlantacion,
};
