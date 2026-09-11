/** Recuentos de los chips de las secciones de Configuración. */
import { formatearEntero, pluralizar, type Sustantivo } from '../../lib/formato';

const HABILITADA: Sustantivo = { singular: 'habilitada', plural: 'habilitadas' };
const ASIGNADO: Sustantivo = { singular: 'asignado', plural: 'asignados' };

/** Especies habilitadas en la plantación, sobre el total del catálogo. */
export function chipEspecies(habilitadas: number, catalogo: number): string {
  return `${pluralizar(habilitadas, HABILITADA)} · ${formatearEntero(catalogo)} en catálogo`;
}

export function chipTecnicos(asignados: number): string {
  return pluralizar(asignados, ASIGNADO);
}
