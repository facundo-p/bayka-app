import { nombresPorPlantacion } from './altasYBajas';

export const SE_ASIGNARA_AL_SINCRONIZAR = 'Se asignará al sincronizar';
export const AYUDA_QUITAR_SIN_CONEXION = 'Quitar técnicos requiere conexión a internet';
export const SIN_TECNICOS =
  'No hay técnicos para asignar. Si la organización tiene técnicos, sincronizá con conexión para traerlos.';

/** Asignado en el teléfono y todavía sin subir. */
export const esAltaPendiente = (t: { assigned: boolean; pendiente: boolean }) => t.assigned && t.pendiente;

/** Por qué el server no asigna a un técnico (#636). */
export const EXPLICACION_TECNICOS_NO_ASIGNADOS =
  'Están dados de baja o ya no pertenecen a la organización, así que se quitaron de la plantación.';

export function mensajeTecnicosNoAsignados(nombres: string[]): string {
  return `No se pudo asignar a ${nombres.join(', ')}. ${EXPLICACION_TECNICOS_NO_ASIGNADOS}`;
}

type ResultadoDeSync = { success: boolean; nombre: string; tecnicosNoAsignados?: string[] };

/** "Plantación: Técnico A, Técnico B" por cada plantación del sync con un alta rechazada. */
export function tecnicosNoAsignadosDe(resultados: ResultadoDeSync[]): string[] {
  return nombresPorPlantacion(resultados, (r) => r.tecnicosNoAsignados);
}
