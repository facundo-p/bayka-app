/*
 * Cómo se reparte el reporte de árboles en hojas, sin renderizar: el documento
 * pinta una hoja por cada una del plan. La estimación por conteos, antes de
 * leer los árboles, da lo mismo con el texto cortado y un piso con el entero.
 * No carga react-pdf: se puede importar de entrada.
 */
import { tieneFotoSubida } from '../../lib/fotoSubida';
import { CORTAR_TEXTO_LARGO } from '../plantilla/textoLargo';
import { CAJA_TARJETA, CUERPO_REPORTE, MEDIDA_REPORTE as M } from '../plantilla/tokens';

export const MODO_REPORTE = {
  /** Los árboles con foto van como tarjeta, hasta el tope. */
  conFotos: 'con-fotos',
  /** Todo al listado, sin bajar ninguna foto. */
  sinFotos: 'sin-fotos',
} as const;

export type ModoReporte = (typeof MODO_REPORTE)[keyof typeof MODO_REPORTE];

/** Los árboles con foto que pasan el tope van al listado, sin bajar su foto. */
export const TOPE_TARJETAS = 400;

/** Lo que llena el cuerpo de una hoja, con el colchón contra los redondeos del layout. */
const ALTO_UTIL = CUERPO_REPORTE.alto - M.holgura;

/** Debajo del encabezado de columnas, que se repite en cada hoja. */
const ALTO_UTIL_LISTADO = ALTO_UTIL - M.altoEncabezadoListado;

/** Con todo en un renglón. */
export const TARJETAS_POR_HOJA = M.columnasTarjetas * M.filasTarjetas;

/** Con todo en un renglón. */
export const FILAS_POR_HOJA = Math.floor(ALTO_UTIL_LISTADO / M.altoFilaListado);

export type Reparto<Tarjeta, Fila = Tarjeta> = { tarjetas: Tarjeta[]; listado: Fila[] };

/** Cada bloque conserva el orden de entrada, que es el del filtro. */
export function repartirArboles<T extends { fotoUrl: string | null }>(
  arboles: readonly T[],
  modo: ModoReporte,
): Reparto<T> {
  const reparto: Reparto<T> = { tarjetas: [], listado: [] };
  const conTarjetas = modo === MODO_REPORTE.conFotos;
  for (const arbol of arboles) {
    const cabe = conTarjetas && reparto.tarjetas.length < TOPE_TARJETAS;
    if (cabe && tieneFotoSubida(arbol.fotoUrl)) reparto.tarjetas.push(arbol);
    else reparto.listado.push(arbol);
  }
  return reparto;
}

export const TIPO_HOJA_REPORTE = { tarjetas: 'tarjetas', listado: 'listado' } as const;

export type HojaReporte<Tarjeta, Fila> =
  | { tipo: typeof TIPO_HOJA_REPORTE.tarjetas; tarjetas: Tarjeta[] }
  | { tipo: typeof TIPO_HOJA_REPORTE.listado; filas: Fila[] };

export function esHojaDeTarjetas<Tarjeta, Fila>(
  hoja: HojaReporte<Tarjeta, Fila>,
): hoja is Extract<HojaReporte<Tarjeta, Fila>, { tipo: typeof TIPO_HOJA_REPORTE.tarjetas }> {
  return hoja.tipo === TIPO_HOJA_REPORTE.tarjetas;
}

/** De a `porTramo` seguidos; el último puede quedar más corto. */
export function enTramos<T>(items: readonly T[], porTramo: number): T[][] {
  const tramos: T[][] = [];
  for (let inicio = 0; inicio < items.length; inicio += porTramo) {
    tramos.push(items.slice(inicio, inicio + porTramo));
  }
  return tramos;
}

/** Alto en pt de cada tarjeta y de cada fila del listado. */
export type AltosReporte<Tarjeta, Fila> = {
  tarjeta: (tarjeta: Tarjeta) => number;
  fila: (fila: Fila) => number;
};

/** Todo en un renglón: el alto mínimo de cada una. */
export const ALTOS_DE_UN_RENGLON: AltosReporte<unknown, unknown> = {
  tarjeta: () => CAJA_TARJETA.alto,
  fila: () => M.altoFilaListado,
};

/** Lo que suma justo el alto útil entra: el redondeo de la suma no deja afuera el último. */
const TOLERANCIA_SUMA = 1e-6;

type Pila = { disponible: number; separacion: number };

/** De a los que entran apilados en `disponible`; uno que solo no entra va igual en su hoja. */
function enTramosPorAlto<T>(items: readonly T[], altoDe: (item: T) => number, pila: Pila): T[][] {
  const tramos: T[][] = [];
  let usado = 0;
  for (const item of items) {
    const alto = altoDe(item);
    const tramo = tramos.at(-1);
    const conItem = usado + pila.separacion + alto;
    if (tramo && conItem <= pila.disponible + TOLERANCIA_SUMA) {
      tramo.push(item);
      usado = conItem;
    } else {
      tramos.push([item]);
      usado = alto;
    }
  }
  return tramos;
}

/** Las filas de tarjetas miden lo que la más alta de cada una. */
function hojasDeTarjetas<T>(tarjetas: readonly T[], altoDe: (tarjeta: T) => number): T[][] {
  const filas = enTramos(tarjetas, M.columnasTarjetas);
  const altoFila = (fila: T[]) => Math.max(...fila.map(altoDe));
  const pila = { disponible: ALTO_UTIL, separacion: M.separacion };
  return enTramosPorAlto(filas, altoFila, pila).map((hoja) => hoja.flat());
}

/**
 * Primero las hojas de tarjetas, después las del listado; el listado arranca en
 * hoja propia. Cada hoja se llena por alto acumulado.
 */
export function paginarReporte<Tarjeta, Fila>(
  { tarjetas, listado }: Reparto<Tarjeta, Fila>,
  altos: AltosReporte<Tarjeta, Fila> = ALTOS_DE_UN_RENGLON,
): HojaReporte<Tarjeta, Fila>[] {
  const pilaListado = { disponible: ALTO_UTIL_LISTADO, separacion: 0 };
  return [
    ...hojasDeTarjetas(tarjetas, altos.tarjeta).map((tramo) => ({
      tipo: TIPO_HOJA_REPORTE.tarjetas,
      tarjetas: tramo,
    })),
    ...enTramosPorAlto(listado, altos.fila, pilaListado).map((tramo) => ({
      tipo: TIPO_HOJA_REPORTE.listado,
      filas: tramo,
    })),
  ];
}

/**
 * Lo que se sabe del filtro sin leer los árboles. `conFoto` cuenta con el criterio
 * de `tieneFotoSubida`: una foto que sigue en el teléfono (`file://`, `content://`)
 * no suma, o la estimación da más tarjetas que el PDF.
 */
export type ConteoReporte = { total: number; conFoto: number; modo: ModoReporte };

export type EstimacionReporte = {
  tarjetas: number;
  filasListado: number;
  hojas: number;
  /** El PDF puede salir con más hojas, y más pesado, que lo estimado. */
  esPiso: boolean;
};

/**
 * Lo mismo que daría `paginarReporte(repartirArboles(...))` con todo en un
 * renglón, solo con los conteos. Con el texto entero, un nombre largo agranda su
 * fila o su tarjeta: las hojas, y el peso que sale de ellas, son un piso (`esPiso`).
 * Si los conteos salen de lecturas distintas, `conFoto` puede pasar a `total`: se acota.
 */
export function estimarReporte({ total, conFoto, modo }: ConteoReporte): EstimacionReporte {
  const conFotoPosible = Math.min(conFoto, total);
  const tarjetas = modo === MODO_REPORTE.conFotos ? Math.min(conFotoPosible, TOPE_TARJETAS) : 0;
  const filasListado = total - tarjetas;
  const hojas = Math.ceil(tarjetas / TARJETAS_POR_HOJA) + Math.ceil(filasListado / FILAS_POR_HOJA);
  return { tarjetas, filasListado, hojas, esPiso: !CORTAR_TEXTO_LARGO };
}
