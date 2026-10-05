import {
  ESTILO_BOTONERA_ORIGINAL,
  ORDEN_BOTONERA,
  TAMANO_LETRA_BOTONERA,
  type EstiloBotonera,
  type OrdenBotonera,
} from '../constants/estiloBotonera';

export const esNombreArriba = (estilo: EstiloBotonera) => estilo.orden === ORDEN_BOTONERA.nombreArriba;

export function limitarTamano(tamano: number): number {
  return Math.min(TAMANO_LETRA_BOTONERA.max, Math.max(TAMANO_LETRA_BOTONERA.min, Math.round(tamano)));
}

export function esEstiloOriginal(estilo: EstiloBotonera): boolean {
  return (
    estilo.orden === ESTILO_BOTONERA_ORIGINAL.orden &&
    estilo.tamanoCodigo === ESTILO_BOTONERA_ORIGINAL.tamanoCodigo &&
    estilo.tamanoNombre === ESTILO_BOTONERA_ORIGINAL.tamanoNombre
  );
}

const esOrdenBotonera = (valor: unknown): valor is OrdenBotonera =>
  Object.values(ORDEN_BOTONERA).includes(valor as OrdenBotonera);

const tamanoGuardado = (valor: unknown, porDefecto: number) =>
  typeof valor === 'number' && Number.isFinite(valor) ? limitarTamano(valor) : porDefecto;

/** Lo guardado en el dispositivo; lo que falte o no se entienda vuelve al diseño original. */
export function leerEstiloBotonera(guardado: string): EstiloBotonera {
  let datos: unknown;
  try {
    datos = JSON.parse(guardado);
  } catch {
    return { ...ESTILO_BOTONERA_ORIGINAL };
  }
  if (typeof datos !== 'object' || datos === null) return { ...ESTILO_BOTONERA_ORIGINAL };
  const { orden, tamanoCodigo, tamanoNombre } = datos as Record<string, unknown>;
  return {
    orden: esOrdenBotonera(orden) ? orden : ESTILO_BOTONERA_ORIGINAL.orden,
    tamanoCodigo: tamanoGuardado(tamanoCodigo, ESTILO_BOTONERA_ORIGINAL.tamanoCodigo),
    tamanoNombre: tamanoGuardado(tamanoNombre, ESTILO_BOTONERA_ORIGINAL.tamanoNombre),
  };
}

export type TextoDelBoton = { texto: string; tamano: number };

/** Los dos textos del botón en el orden en que se ven: el primero va arriba y en negrita. */
export function textosDelBoton(
  estilo: EstiloBotonera,
  codigo: string,
  nombre: string,
): [TextoDelBoton, TextoDelBoton] {
  const elCodigo = { texto: codigo, tamano: estilo.tamanoCodigo };
  const elNombre = { texto: nombre, tamano: estilo.tamanoNombre };
  return esNombreArriba(estilo) ? [elNombre, elCodigo] : [elCodigo, elNombre];
}

/** Para la vista previa: la especie de nombre más corto y la de nombre más largo. */
export function especiesDeMuestra<T extends { nombre: string }>(especies: readonly T[]): T[] {
  if (especies.length < 2) return [...especies];
  const porLargo = [...especies].sort((a, b) => a.nombre.length - b.nombre.length);
  return [porLargo[0], porLargo[porLargo.length - 1]];
}
