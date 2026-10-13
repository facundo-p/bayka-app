/*
 * Dónde va el mapa del informe. Todo lo demás fluye y react-pdf lo parte en
 * hojas; acá se simula ese flujo con el alto de cada tramo, según en cuántos
 * renglones quedaron sus textos, para saber cuánto queda libre en la última hoja.
 */
import {
  ALTO_RENGLON_INFORME as ALTO,
  altoConRenglones,
  CAJA_MAPA_INFORME,
  CUERPO_HOJA,
  MEDIDA_INFORME as M,
} from '../plantilla/tokens';
import { enTramos } from '../plantilla/tramos';
import type {
  FilaEspecieEnRenglones,
  InformeConMapa,
  InformeEnRenglones,
  ItemLeyendaEnRenglones,
} from './renglonesInforme';

export const UBICACION_MAPA = {
  /** Al pie de la última hoja, en lo que queda libre. */
  ultimaHoja: 'ultima-hoja',
  /** Al principio de una hoja nueva al final, con su título. */
  hojaCompleta: 'hoja-completa',
} as const;

export type UbicacionMapa = (typeof UBICACION_MAPA)[keyof typeof UBICACION_MAPA];

export type PlanInforme = { ubicacion: UbicacionMapa };

export function esMapaEnHojaCompleta(plan: PlanInforme): boolean {
  return plan.ubicacion === UBICACION_MAPA.hojaCompleta;
}

const ALTO_ENCABEZADO_BLOQUE =
  M.altoEncabezadoBloque + M.aireEncabezadoBloque + M.separacionEncabezadoBloque;

/**
 * Lo que ocupa un tramo que no se parte. `presencia` es lo que tiene que entrar
 * para que arranque en esta hoja, si es más que su alto.
 */
export type Renglon = { alto: number; presencia?: number };

/**
 * El título de bloque no queda solo al pie de una hoja: arranca si entra con lo
 * que lo sigue, pero ocupa solo lo suyo y su primer renglón.
 */
function conEncabezado([primero = 0, ...resto]: number[]): Renglon[] {
  const inicio = {
    alto: ALTO_ENCABEZADO_BLOQUE + primero,
    presencia: ALTO_ENCABEZADO_BLOQUE + Math.max(primero, M.presenciaTrasEncabezado),
  };
  return [inicio, ...resto.map((alto) => ({ alto }))];
}

const altoFila = ({ titulo }: FilaEspecieEnRenglones) =>
  altoConRenglones(M.altoFilaEspecie, ALTO.fila, titulo.length) + M.separacionFilaEspecie;

function renglonesEspecies({ especies }: InformeEnRenglones): Renglon[] {
  return conEncabezado(especies.vacio ? [M.altoMensaje] : especies.filas.map(altoFila));
}

function altoTitulo({ linea }: InformeEnRenglones): number {
  const lineas = altoConRenglones(M.altoLineaTitulo, ALTO.linea, linea.length);
  return M.altoTitulo + M.aireTitulo + lineas + M.separacionBloques;
}

/** Cada tramo que no se parte, en el orden del documento. */
export function renglonesDelFlujo(modelo: InformeEnRenglones): Renglon[] {
  return [
    { alto: altoTitulo(modelo) },
    { alto: M.altoIndicadores + M.separacionBloques },
    ...renglonesEspecies(modelo),
  ];
}

/** Alto ocupado en la última hoja: un renglón que no entra empieza la hoja siguiente. */
export function altoEnUltimaHoja(renglones: readonly Renglon[]): number {
  return renglones.reduce(
    (ocupado, { alto, presencia = alto }) =>
      ocupado + Math.max(alto, presencia) > CUERPO_HOJA.alto ? alto : ocupado + alto,
    0,
  );
}

const ITEMS_POR_FILA_LEYENDA = Math.floor(
  (CUERPO_HOJA.ancho + M.separacionLeyenda) / (M.anchoItemLeyenda + M.separacionLeyenda),
);

const altoItemLeyenda = ({ texto }: ItemLeyendaEnRenglones) =>
  altoConRenglones(M.altoRenglonLeyenda, ALTO.leyenda, texto.length);

/** Cada fila de la leyenda mide lo que su ítem más alto; sin ítems, igual ocupa una. */
export function altoLeyenda({ mapa }: InformeConMapa): number {
  const filas = enTramos(mapa.leyenda, ITEMS_POR_FILA_LEYENDA);
  const altos = filas.map((fila) => Math.max(...fila.map(altoItemLeyenda)));
  const alto = altos.reduce((suma, altoFila) => suma + altoFila, 0);
  return M.aireMapa + Math.max(alto, M.altoRenglonLeyenda);
}

/** Lo que acompaña al mapa al pie: separación, título de bloque, leyenda, nota y el colchón. */
function altoQueAcompana(modelo: InformeConMapa): number {
  const titulo = M.separacionBloques + ALTO_ENCABEZADO_BLOQUE;
  return titulo + altoLeyenda(modelo) + M.aireMapa + M.altoNotaMapa + M.holgura;
}

/** Lo que tiene que quedar libre en la última hoja para que el mapa 16:9 vaya al pie. */
export function libreMinimoAlPie(modelo: InformeConMapa): number {
  return altoQueAcompana(modelo) + CAJA_MAPA_INFORME.alto;
}

/** Al pie si en lo que queda `libre` entran el mapa y lo que lo acompaña; si no, en hoja nueva. */
export function planSegunLibre(modelo: InformeConMapa, libre: number): PlanInforme {
  const ubicacion =
    libre < libreMinimoAlPie(modelo) ? UBICACION_MAPA.hojaCompleta : UBICACION_MAPA.ultimaHoja;
  return { ubicacion };
}

export function planificarInforme(modelo: InformeConMapa): PlanInforme {
  return planSegunLibre(modelo, CUERPO_HOJA.alto - altoEnUltimaHoja(renglonesDelFlujo(modelo)));
}
