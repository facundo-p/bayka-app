/**
 * Textos del aviso de pendientes varados en la tarjeta y de su "Descartar" (#638).
 * Descartar es irreversible: la confirmación dice exactamente qué se pierde.
 */
import { MOTIVO_VARADO, type MotivoVarado } from '../constants/motivoVarado';
import { esEliminadaEnServidor } from '../constants/estados';
import type { ResumenDePendientes } from '../queries/catalogQueries';
import { detalleDePendientes } from './avisoEliminarDelDispositivo';

export type ResumenDeDescarte = ResumenDePendientes & {
  /** Edición de los datos de la plantación sin subir. */
  edicion: boolean;
  /** Creada en el teléfono y nunca terminó de subir: se pierde entera. */
  alta: boolean;
};

type FilaVarada = { motivoVarado: MotivoVarado | null; eliminadaEnServidorEn: string | null };

/** La eliminada sale de la marca del pull; el resto, de lo que guardó el sync. */
export function motivoDeVarado(fila: FilaVarada): MotivoVarado | null {
  return esEliminadaEnServidor(fila) ? MOTIVO_VARADO.eliminada : fila.motivoVarado;
}

/** Descartar la saca del dispositivo: un alta que nunca terminó de subir o una eliminada en el servidor. */
export function descartarLaSaca(fila: { pendingSync: boolean; eliminadaEnServidorEn: string | null }): boolean {
  return fila.pendingSync || esEliminadaEnServidor(fila);
}

export function totalDeCambios(r: ResumenDeDescarte): number {
  return Number(r.alta) + Number(r.edicion) + r.activaCount + r.finalizadaCount
    + r.parcelas + r.fotos + r.borrados + r.especies + r.tecnicos;
}

export function tituloDelAviso(total: number): string {
  return total === 1 ? '1 cambio no se pudo subir' : `${total} cambios no se pudieron subir`;
}

const TEXTO_DEL_MOTIVO: Record<MotivoVarado, string> = {
  [MOTIVO_VARADO.finalizada]: 'La plantación está finalizada. Si la reabren, se suben solos.',
  [MOTIVO_VARADO.archivada]: 'La plantación está archivada. Si la desarchivan, se suben solos.',
  [MOTIVO_VARADO.eliminada]: 'La plantación fue eliminada en el servidor.',
  [MOTIVO_VARADO.sinPermiso]: 'Tu usuario no tiene permiso para subirlos. Si te lo devuelven, se suben solos.',
};

export function textoDelMotivo(motivo: MotivoVarado): string {
  return TEXTO_DEL_MOTIVO[motivo];
}

/** Título y motivo del aviso de la tarjeta. */
export function avisoDeLaTarjeta(varados: { motivo: MotivoVarado; resumen: ResumenDeDescarte }): { titulo: string; motivo: string } {
  return { titulo: tituloDelAviso(totalDeCambios(varados.resumen)), motivo: textoDelMotivo(varados.motivo) };
}

/** "la plantación entera, los cambios en sus datos, 2 grupos sin subir (…)". */
export function detalleDeDescarte(r: ResumenDeDescarte): string {
  const partes = [
    r.alta && 'la plantación entera, que nunca llegó al servidor',
    r.edicion && 'los cambios en los datos de la plantación',
    detalleDePendientes(r),
  ];
  return partes.filter(Boolean).join(', ');
}

export interface ConfirmacionDeDescarte {
  titulo: string;
  mensaje: string;
  boton: string;
}

/** Con `seVa` (ver `descartarLaSaca`), la plantación sale del dispositivo. */
export function confirmacionDeDescarte(params: { lugar: string; resumen: ResumenDeDescarte; seVa: boolean }): ConfirmacionDeDescarte {
  const { lugar, resumen, seVa } = params;
  const despues = seVa
    ? `"${lugar}" se elimina de este dispositivo.`
    : `"${lugar}" vuelve a quedar como está en el servidor en la próxima sincronización.`;
  return {
    titulo: 'Descartar cambios sin subir',
    mensaje: `Se pierden para siempre: ${detalleDeDescarte(resumen)}. ${despues} Esta acción no se puede deshacer.`,
    boton: 'Descartar',
  };
}
