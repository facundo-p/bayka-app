/**
 * Una plantación que dejó de ser escribible desde que se cargó la pantalla:
 * eliminada, archivada o finalizada. Traduce el motivo que devuelve el server a un
 * mensaje que dice qué pasó (#522).
 */
import { SYNC_ERROR } from './sync/types';

/** Valores de `motivo_no_escribible` (server). */
export const MOTIVO_NO_ESCRIBIBLE = {
  inexistente: 'PLANTACION_INEXISTENTE',
  archivada: SYNC_ERROR.PLANTACION_ARCHIVADA,
  finalizada: SYNC_ERROR.PLANTACION_FINALIZADA,
} as const;

export type MotivoNoEscribible = (typeof MOTIVO_NO_ESCRIBIBLE)[keyof typeof MOTIVO_NO_ESCRIBIBLE];

const NO_SE_GUARDARON = 'Los cambios no se guardaron.';

const MENSAJE_POR_MOTIVO: Record<MotivoNoEscribible, string> = {
  [MOTIVO_NO_ESCRIBIBLE.inexistente]: `La plantación ya no existe en el servidor. ${NO_SE_GUARDARON}`,
  [MOTIVO_NO_ESCRIBIBLE.archivada]: `La plantación está archivada y no acepta cambios. ${NO_SE_GUARDARON}`,
  [MOTIVO_NO_ESCRIBIBLE.finalizada]:
    `La plantación está finalizada: solo un superadmin puede cambiar su configuración. ${NO_SE_GUARDARON}`,
};

const TODOS_LOS_MOTIVOS: readonly MotivoNoEscribible[] = Object.values(MOTIVO_NO_ESCRIBIBLE);

export function esMotivoNoEscribible(codigo: string): codigo is MotivoNoEscribible {
  return (TODOS_LOS_MOTIVOS as readonly string[]).includes(codigo);
}

export class PlantacionNoEscribibleError extends Error {
  constructor(readonly motivo: MotivoNoEscribible) {
    super(MENSAJE_POR_MOTIVO[motivo]);
    this.name = 'PlantacionNoEscribibleError';
  }
}
