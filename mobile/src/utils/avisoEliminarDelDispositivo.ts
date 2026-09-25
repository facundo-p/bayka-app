/**
 * Textos del aviso de "Eliminar del dispositivo". Es irreversible: el aviso dice qué
 * se pierde, y para una plantación eliminada en el server, que eso ya no se puede subir (#478).
 */
import type { ResumenDePendientes } from '../queries/catalogQueries';

export interface AvisoEliminarDelDispositivo {
  titulo: string;
  mensaje: string;
  /** Presente cuando hay datos que se pierden: pide una segunda confirmación. */
  confirmacionFinal?: string;
}

const CONFIRMACION_FINAL =
  'Los datos sin sincronizar se perderán para siempre. Esta acción no se puede deshacer.';

function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/** "2 grupos sin subir (1 activo, 1 finalizado), 3 fotos sin subir". Vacío si no hay nada. */
export function detalleDePendientes(r: ResumenDePendientes): string {
  const grupos = r.activaCount + r.finalizadaCount;
  const partes = [
    grupos > 0 &&
      `${plural(grupos, 'grupo')} sin subir (${plural(r.activaCount, 'activo')}, ${plural(r.finalizadaCount, 'finalizado')})`,
    r.parcelas > 0 && `${plural(r.parcelas, 'parcela pendiente', 'parcelas pendientes')}`,
    r.fotos > 0 && `${plural(r.fotos, 'foto')} sin subir`,
    r.borrados > 0 && `${plural(r.borrados, 'borrado pendiente', 'borrados pendientes')}`,
    r.especies > 0 && `${plural(r.especies, 'cambio de especies', 'cambios de especies')} sin subir`,
    r.tecnicos > 0 && `${plural(r.tecnicos, 'técnico asignado', 'técnicos asignados')} sin subir`,
  ];
  return partes.filter(Boolean).join(', ');
}

function avisoConPendientes(lugar: string, eliminada: boolean, detalle: string): AvisoEliminarDelDispositivo {
  if (eliminada) {
    return {
      titulo: 'Plantación eliminada en el servidor',
      mensaje: `"${lugar}" fue eliminada en el servidor, así que estos datos ya no se pueden subir: ${detalle}. Si la eliminás del dispositivo se pierden para siempre.`,
      confirmacionFinal: CONFIRMACION_FINAL,
    };
  }
  return {
    titulo: 'Atención: datos sin sincronizar',
    mensaje: `"${lugar}" tiene datos sin subir al servidor: ${detalle}. Si eliminás ahora, esos datos se perderán permanentemente.`,
    confirmacionFinal: CONFIRMACION_FINAL,
  };
}

export function avisoEliminarDelDispositivo(params: {
  lugar: string;
  eliminada: boolean;
  resumen: ResumenDePendientes;
}): AvisoEliminarDelDispositivo {
  const { lugar, eliminada, resumen } = params;
  const detalle = detalleDePendientes(resumen);
  if (detalle) return avisoConPendientes(lugar, eliminada, detalle);
  return {
    titulo: 'Eliminar del dispositivo',
    mensaje: eliminada
      ? `"${lugar}" fue eliminada en el servidor: si la eliminás de tu celular no vas a poder volver a descargarla. Esta acción no se puede deshacer.`
      : `La plantación "${lugar}" será eliminada de tu celular. Podés volver a descargarla desde el catálogo.`,
  };
}
