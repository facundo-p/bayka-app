/*
 * Cómo se reparte el reporte de árboles en hojas, sin renderizar: el documento
 * pinta una hoja por cada una del plan, y la estimación por conteos da lo mismo
 * antes de leer los árboles. No carga react-pdf: se puede importar de entrada.
 */
import { tieneFotoSubida } from '../../services/fotoService';
import { CUERPO_REPORTE, MEDIDA_REPORTE as M } from '../plantilla/tokens';

export const MODO_REPORTE = {
  /** Los árboles con foto van como tarjeta, hasta el tope. */
  conFotos: 'con-fotos',
  /** Todo al listado, sin bajar ninguna foto. */
  sinFotos: 'sin-fotos',
} as const;

export type ModoReporte = (typeof MODO_REPORTE)[keyof typeof MODO_REPORTE];

/** Los árboles con foto que pasan el tope van al listado, sin bajar su foto. */
export const TOPE_TARJETAS = 400;

export const TARJETAS_POR_HOJA = M.columnasTarjetas * M.filasTarjetas;

/** Las que entran debajo del encabezado de columnas, que se repite en cada hoja. */
export const FILAS_POR_HOJA = Math.floor(
  (CUERPO_REPORTE.alto - M.holgura - M.altoEncabezadoListado) / M.altoFilaListado,
);

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

/** Primero las hojas de tarjetas, después las del listado; el listado arranca en hoja propia. */
export function paginarReporte<Tarjeta, Fila>({
  tarjetas,
  listado,
}: Reparto<Tarjeta, Fila>): HojaReporte<Tarjeta, Fila>[] {
  return [
    ...enTramos(tarjetas, TARJETAS_POR_HOJA).map((tramo) => ({
      tipo: TIPO_HOJA_REPORTE.tarjetas,
      tarjetas: tramo,
    })),
    ...enTramos(listado, FILAS_POR_HOJA).map((tramo) => ({
      tipo: TIPO_HOJA_REPORTE.listado,
      filas: tramo,
    })),
  ];
}

/** Lo que se sabe del filtro sin leer los árboles. `conFoto` cuenta solo las fotos subidas. */
export type ConteoReporte = { total: number; conFoto: number; modo: ModoReporte };

export type EstimacionReporte = { tarjetas: number; filasListado: number; hojas: number };

/** Lo mismo que daría `paginarReporte(repartirArboles(...))`, solo con los conteos. */
export function estimarReporte({ total, conFoto, modo }: ConteoReporte): EstimacionReporte {
  const tarjetas = modo === MODO_REPORTE.conFotos ? Math.min(conFoto, TOPE_TARJETAS) : 0;
  const filasListado = total - tarjetas;
  const hojas = Math.ceil(tarjetas / TARJETAS_POR_HOJA) + Math.ceil(filasListado / FILAS_POR_HOJA);
  return { tarjetas, filasListado, hojas };
}
