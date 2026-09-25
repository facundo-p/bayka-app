/**
 * Textos del aviso de pendientes varados en la tarjeta y de su "Descartar" (#638).
 * Descartar es irreversible: la confirmación dice exactamente qué se pierde.
 */
import { MOTIVO_VARADO, type MotivoVarado } from '../constants/motivoVarado';
import { esEliminadaEnServidor } from '../constants/estados';
import type { ResumenDePendientes } from '../queries/catalogQueries';
import { CONFIRMACION_FINAL, detalleDePendientes } from './avisoEliminarDelDispositivo';

/** `fotos`: solo las de grupos ya subidos; las de un grupo pendiente van con él. */
export type ResumenDeDescarte = ResumenDePendientes & {
  /** Edición de los datos de la plantación sin subir. */
  edicion: boolean;
  /** Creada en el teléfono y nunca terminó de subir. */
  alta: boolean;
  /** El alta llegó a insertarse y falló después (sus especies): en el server existe. */
  altaEnServidor: boolean;
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

/**
 * En una finalizada el server sí acepta técnicos y fotos de grupos ya subidos: suben en la
 * próxima sync, así que ni se cuentan como varados ni se descartan.
 */
export function conservaLoQueSube(motivo: MotivoVarado | null): boolean {
  return motivo === MOTIVO_VARADO.finalizada;
}

/** Lo que de verdad no puede subir, con ese motivo. */
export function varadosDelResumen(r: ResumenDeDescarte, motivo: MotivoVarado | null): ResumenDeDescarte {
  return conservaLoQueSube(motivo) ? { ...r, tecnicos: 0, fotos: 0 } : r;
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

function detalleDelAlta(r: ResumenDeDescarte): string | false {
  if (!r.alta) return false;
  return r.altaEnServidor
    ? 'la plantación, que quedó a medio subir (en el servidor está creada, sin sus especies ni lo cargado en este teléfono)'
    : 'la plantación entera, que no terminó de subir';
}

/** "la plantación entera, los cambios en sus datos, 2 grupos sin subir (…)". */
export function detalleDeDescarte(r: ResumenDeDescarte): string {
  const partes = [detalleDelAlta(r), r.edicion && 'los cambios en los datos de la plantación', detalleDePendientes(r)];
  return partes.filter(Boolean).join(', ');
}

export interface ConfirmacionDeDescarte {
  titulo: string;
  mensaje: string;
  boton: string;
  /** Presente cuando la plantación sale del dispositivo: pide una segunda confirmación, como "Eliminar del dispositivo". */
  confirmacionFinal?: string;
}

function queQueda(lugar: string, resumen: ResumenDeDescarte, seVa: boolean, motivo: MotivoVarado | null): string {
  const sinPermiso = motivo === MOTIVO_VARADO.sinPermiso;
  // El catálogo muestra una finalizada; una archivada no (#477), y sin permiso quizá tampoco.
  if (seVa && resumen.altaEnServidor && motivo === MOTIVO_VARADO.finalizada) {
    return `"${lugar}" se elimina de este dispositivo; podés volver a descargarla desde el catálogo.`;
  }
  if (seVa) return `"${lugar}" se elimina de este dispositivo.`;
  // Sin permiso no se promete cuándo vuelve lo del servidor: sin membresía el pull no corre y
  // sin rol sí. Tampoco se distingue localmente un grupo ya subido de uno nuevo.
  if (sinPermiso) return 'Lo que ya estaba en el servidor sigue ahí.';
  return `"${lugar}" vuelve a quedar como está en el servidor en la próxima sincronización.`;
}

/** Con `seVa` (ver `descartarLaSaca`), la plantación sale del dispositivo. */
export function confirmacionDeDescarte(params: {
  lugar: string; resumen: ResumenDeDescarte; seVa: boolean; motivo: MotivoVarado | null;
}): ConfirmacionDeDescarte {
  const { lugar, resumen, seVa, motivo } = params;
  return {
    titulo: 'Descartar cambios sin subir',
    mensaje: `Se pierden para siempre: ${detalleDeDescarte(resumen)}. ${queQueda(lugar, resumen, seVa, motivo)} Esta acción no se puede deshacer.`,
    boton: 'Descartar',
    ...(seVa ? { confirmacionFinal: CONFIRMACION_FINAL } : {}),
  };
}
