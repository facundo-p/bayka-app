/*
 * Qué suma el informe PDF a lo que sale siempre (árboles registrados y
 * distribución por especie), y la última elección de este navegador.
 */
import { CLAVE_STORAGE, guardarLocal, leerLocal } from './almacenamientoLocal';

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

const marcadas = (opciones: OpcionesInforme) =>
  LISTA_OPCIONES_INFORME.filter((opcion) => opciones[opcion]);

const esOpcionInforme = (valor: unknown): valor is OpcionInforme =>
  LISTA_OPCIONES_INFORME.includes(valor as OpcionInforme);

/** Igual que el dashboard: un objetivo en 0 tampoco es meta. */
export const tieneObjetivo = (objetivo: number | null): objetivo is number =>
  objetivo !== null && objetivo > 0;

/** Sin objetivo no hay meta que mostrar: la casilla cuenta como no marcada. */
export function opcionesSegunObjetivo(
  eleccion: OpcionesInforme,
  objetivo: number | null,
): OpcionesInforme {
  if (tieneObjetivo(objetivo)) return eleccion;
  return { ...eleccion, [OPCION_INFORME.meta]: false };
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
  guardarLocal(CLAVE_STORAGE.opcionesInforme, JSON.stringify(marcadas(opciones)));
}
