/*
 * Qué suma el informe PDF a lo que sale siempre (árboles registrados y
 * distribución por especie), y la última elección de este navegador.
 */
import { CLAVE_STORAGE, guardarLocal, leerLocal } from './almacenamientoLocal';
import { porcentajeDeObjetivo } from './formato';

/** En el orden del modal, que es el del documento. */
export const OPCION_INFORME = {
  meta: 'meta',
  gps: 'gps',
  foto: 'foto',
  mapa: 'mapa',
} as const;

export type OpcionInforme = (typeof OPCION_INFORME)[keyof typeof OPCION_INFORME];

export type OpcionesInforme = Readonly<Record<OpcionInforme, boolean>>;

export const LISTA_OPCIONES_INFORME: readonly OpcionInforme[] = Object.values(OPCION_INFORME);

/** Las opciones con solo `marcadas` en true. */
export function opcionesCon(marcadas: Iterable<OpcionInforme>): OpcionesInforme {
  const elegidas = new Set(marcadas);
  return Object.fromEntries(
    LISTA_OPCIONES_INFORME.map((opcion) => [opcion, elegidas.has(opcion)]),
  ) as Record<OpcionInforme, boolean>;
}

export const SIN_OPCIONES = opcionesCon([]);

const soloMarcadas = (opciones: OpcionesInforme) =>
  LISTA_OPCIONES_INFORME.filter((opcion) => opciones[opcion]);

const esOpcionInforme = (valor: unknown): valor is OpcionInforme =>
  LISTA_OPCIONES_INFORME.includes(valor as OpcionInforme);

/** Con la regla del dashboard: hay meta si hay avance que medir, y un objetivo en 0 no es meta. */
const tieneObjetivo = (objetivo: number | null) => porcentajeDeObjetivo(0, objetivo) !== null;

/** La meta, en una plantación sin objetivo: no se puede elegir. */
export const opcionBloqueada = (opcion: OpcionInforme, objetivo: number | null): boolean =>
  opcion === OPCION_INFORME.meta && !tieneObjetivo(objetivo);

/** Lo que de verdad lleva el informe: una opción bloqueada cuenta como no marcada. */
export function opcionesSegunObjetivo(
  eleccion: OpcionesInforme,
  objetivo: number | null,
): OpcionesInforme {
  return opcionesCon(soloMarcadas(eleccion).filter((opcion) => !opcionBloqueada(opcion, objetivo)));
}

/** Sin nada guardado, con el storage bloqueado o con un valor ilegible: ninguna marcada. */
export function leerOpcionesInforme(): OpcionesInforme {
  const crudo = leerLocal(CLAVE_STORAGE.opcionesInforme);
  if (!crudo) return SIN_OPCIONES;
  try {
    const guardadas: unknown = JSON.parse(crudo);
    return Array.isArray(guardadas) ? opcionesCon(guardadas.filter(esOpcionInforme)) : SIN_OPCIONES;
  } catch {
    return SIN_OPCIONES;
  }
}

/** Se guardan las marcadas: una opción que se agregue después arranca sin marcar. */
export function guardarOpcionesInforme(opciones: OpcionesInforme): void {
  guardarLocal(CLAVE_STORAGE.opcionesInforme, JSON.stringify(soloMarcadas(opciones)));
}
