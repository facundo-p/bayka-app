/*
 * Dónde va el mapa del informe. Todo lo demás fluye y react-pdf lo parte en
 * hojas; acá se simula ese flujo con los altos fijos de los renglones para
 * saber cuánto queda libre en la última hoja.
 */
import { CAJA_MAPA_INFORME, CUERPO_HOJA, MEDIDA_INFORME as M } from '../plantilla/tokens';
import type { ModeloConMapa, ModeloInforme } from './datosInforme';

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

function renglonesEspecies({ especies }: ModeloInforme): Renglon[] {
  const fila = M.altoFilaEspecie + M.separacionFilaEspecie;
  return conEncabezado(especies.vacio ? [M.altoMensaje] : especies.filas.map(() => fila));
}

/** Cada tramo que no se parte, en el orden del documento. */
function renglonesDelFlujo(modelo: ModeloInforme): Renglon[] {
  return [
    { alto: M.altoTitulo + M.aireTitulo + M.altoLineaTitulo + M.separacionBloques },
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

function renglonesLeyenda(items: number): number {
  const porRenglon = Math.floor(
    (CUERPO_HOJA.ancho + M.separacionLeyenda) / (M.anchoItemLeyenda + M.separacionLeyenda),
  );
  return Math.max(1, Math.ceil(items / porRenglon));
}

function altoLeyenda(modelo: ModeloConMapa): number {
  return M.aireMapa + renglonesLeyenda(modelo.mapa.leyenda.length) * M.altoRenglonLeyenda;
}

/** Lo que acompaña al mapa al pie: separación, título de bloque, leyenda, nota y el colchón. */
function altoQueAcompana(modelo: ModeloConMapa): number {
  const titulo = M.separacionBloques + ALTO_ENCABEZADO_BLOQUE;
  return titulo + altoLeyenda(modelo) + M.aireMapa + M.altoNotaMapa + M.holgura;
}

/** Lo que tiene que quedar libre en la última hoja para que el mapa 16:9 vaya al pie. */
export function libreMinimoAlPie(modelo: ModeloConMapa): number {
  return altoQueAcompana(modelo) + CAJA_MAPA_INFORME.alto;
}

/** Al pie si en lo que queda `libre` entran el mapa y lo que lo acompaña; si no, en hoja nueva. */
export function planSegunLibre(modelo: ModeloConMapa, libre: number): PlanInforme {
  const ubicacion =
    libre < libreMinimoAlPie(modelo) ? UBICACION_MAPA.hojaCompleta : UBICACION_MAPA.ultimaHoja;
  return { ubicacion };
}

export function planificarInforme(modelo: ModeloConMapa): PlanInforme {
  return planSegunLibre(modelo, CUERPO_HOJA.alto - altoEnUltimaHoja(renglonesDelFlujo(modelo)));
}
