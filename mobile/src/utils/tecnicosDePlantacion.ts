import { altasYBajasDeLaSeleccion, nombresPorPlantacion, type AltasYBajas } from './altasYBajas';

export const ETIQUETA_TECNICO = 'Técnico';
export const ICONO_TECNICOS = 'people-outline';
export const SE_ASIGNARA_AL_SINCRONIZAR = 'Se asignará al sincronizar';
export const AYUDA_QUITAR_SIN_CONEXION = 'Quitar técnicos requiere conexión a internet';
export const MENSAJE_BAJA_SIN_RESPUESTA = 'No se pudo confirmar la baja en el servidor. Se verá al sincronizar.';
export const SIN_TECNICOS =
  'No hay técnicos para asignar. Si la organización tiene técnicos, sincronizá con conexión para traerlos.';
/** Un técnico sin nombre ni en el caché ni en la cola. */
export const TECNICO_SIN_NOMBRE = 'Técnico sin nombre';

/** Títulos del aviso de técnicos que el server no asignó: en la pantalla y en el resumen del sync. */
export const TITULO_TECNICOS_NO_ASIGNADOS = 'Técnicos no asignados';
export const TITULO_AVISO_TECNICOS_NO_ASIGNADOS = 'Técnicos que no se asignaron';

/** Por qué el server no asigna a un técnico (#636). */
export const EXPLICACION_TECNICOS_NO_ASIGNADOS =
  'Están dados de baja, ya no son técnicos o no pertenecen a la organización, así que se quitaron de la plantación.';

export function mensajeTecnicosNoAsignados(nombres: string[]): string {
  return `No se pudo asignar a ${nombres.join(', ')}. ${EXPLICACION_TECNICOS_NO_ASIGNADOS}`;
}

type ResultadoDeSync = { success: boolean; nombre: string; tecnicosNoAsignados?: string[] };

/** "Plantación: Técnico A, Técnico B" por cada plantación del sync con un alta rechazada. */
export function tecnicosNoAsignadosDe(resultados: ResultadoDeSync[]): string[] {
  return nombresPorPlantacion(resultados, (r) => r.tecnicosNoAsignados);
}

type Asignable = { id: string; assigned: boolean; pendiente: boolean };

/** Asignado en el teléfono y todavía sin subir. */
export const esAltaPendiente = (t: { assigned: boolean; pendiente: boolean }) => t.assigned && t.pendiente;

export function cambiosDeLaPantalla<T extends Asignable>(iniciales: T[], actuales: T[]): AltasYBajas {
  return altasYBajasDeLaSeleccion(iniciales, actuales, (t) => t.id, (t) => t.assigned);
}

/**
 * La lista refrescada del server, con lo que el usuario ya tocó en la pantalla: el
 * refresco llega en segundo plano y no puede deshacerle los cambios.
 */
export function conCambiosDeLaPantalla<T extends Asignable>(nuevos: T[], previa: { iniciales: T[]; items: T[] }): T[] {
  const { altas, bajas } = cambiosDeLaPantalla(previa.iniciales, previa.items);
  return nuevos.map((t) => {
    if (altas.includes(t.id)) return { ...t, assigned: true };
    if (bajas.includes(t.id)) return { ...t, assigned: false };
    return t;
  });
}
