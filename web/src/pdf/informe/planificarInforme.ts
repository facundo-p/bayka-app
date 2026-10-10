/*
 * Dónde va el mapa del informe. Todo lo demás fluye y react-pdf lo parte en
 * hojas; acá se simula ese flujo con los altos fijos de los renglones para
 * saber cuánto queda libre en la última hoja.
 */
import { CAJA_MAPA_INFORME, CUERPO_HOJA, MEDIDA_INFORME as M } from '../plantilla/tokens';
import type { ModeloInforme } from './datosInforme';

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

/** Lo que ocupa un tramo que no se parte; `alEmpezarHoja` es lo que suma si abre una hoja. */
export type Renglon = { alto: number; alEmpezarHoja: number };

const renglon = (alto: number, alEmpezarHoja = 0): Renglon => ({ alto, alEmpezarHoja });

/** El título de bloque no queda solo al pie de una hoja: viaja con lo que lo sigue. */
function conEncabezado([primero = 0, ...resto]: number[]): number[] {
  return [ALTO_ENCABEZADO_BLOQUE + Math.max(primero, M.presenciaTrasEncabezado), ...resto];
}

function renglonesEspecies({ especies }: ModeloInforme): Renglon[] {
  const fila = M.altoFilaEspecie + M.separacionFilaEspecie;
  return conEncabezado(especies.vacio ? [M.altoMensaje] : especies.filas.map(() => fila)).map(
    (alto) => renglon(alto),
  );
}

/** Las filas y el total; en una hoja nueva, el encabezado de columnas se repite. */
function renglonesTabla({ parcelas }: ModeloInforme): Renglon[] {
  if (parcelas.vacio) return conEncabezado([M.altoMensaje]).map((alto) => renglon(alto));
  // La última fila y el total van juntos: no se parten.
  const sueltas = parcelas.filas.slice(0, -1).map(() => M.altoFilaTabla);
  const [primera, ...resto] = [...sueltas, M.altoFilaTabla * 2];
  const [inicio, ...siguientes] = conEncabezado([M.altoEncabezadoTabla + primera, ...resto]);
  return [renglon(inicio), ...siguientes.map((alto) => renglon(alto, M.altoEncabezadoTabla))];
}

/** Cada tramo que no se parte, en el orden del documento. */
function renglonesDelFlujo(modelo: ModeloInforme): Renglon[] {
  const [tabla, ...restoTabla] = renglonesTabla(modelo);
  return [
    renglon(M.altoTitulo + M.aireTitulo + M.altoLineaTitulo + M.separacionBloques),
    renglon(M.altoIndicadores + M.separacionBloques),
    ...renglonesEspecies(modelo),
    { ...tabla, alto: M.separacionBloques + tabla.alto },
    ...restoTabla,
  ];
}

/** Alto ocupado en la última hoja: un renglón que no entra empieza la hoja siguiente. */
export function altoEnUltimaHoja(renglones: readonly Renglon[]): number {
  return renglones.reduce(
    (ocupado, { alto, alEmpezarHoja }) =>
      ocupado + alto > CUERPO_HOJA.alto ? alto + alEmpezarHoja : ocupado + alto,
    0,
  );
}

function renglonesLeyenda(items: number): number {
  const porRenglon = Math.floor(
    (CUERPO_HOJA.ancho + M.separacionLeyenda) / (M.anchoItemLeyenda + M.separacionLeyenda),
  );
  return Math.max(1, Math.ceil(items / porRenglon));
}

function altoLeyenda(modelo: ModeloInforme): number {
  return M.aireMapa + renglonesLeyenda(modelo.mapa.leyenda.length) * M.altoRenglonLeyenda;
}

/** Lo que acompaña al mapa al pie: título de bloque, leyenda, nota y el colchón. */
function altoQueAcompana(modelo: ModeloInforme): number {
  const titulo = M.separacionBloques + ALTO_ENCABEZADO_BLOQUE;
  return titulo + altoLeyenda(modelo) + M.aireMapa + M.altoNotaMapa + M.holgura;
}

/** Lo que tiene que quedar libre en la última hoja para que el mapa 16:9 vaya al pie. */
export function libreMinimoAlPie(modelo: ModeloInforme): number {
  return altoQueAcompana(modelo) + CAJA_MAPA_INFORME.alto;
}

/** Al pie si en lo que queda `libre` entran el mapa y lo que lo acompaña; si no, en hoja nueva. */
export function planSegunLibre(modelo: ModeloInforme, libre: number): PlanInforme {
  const ubicacion =
    libre < libreMinimoAlPie(modelo) ? UBICACION_MAPA.hojaCompleta : UBICACION_MAPA.ultimaHoja;
  return { ubicacion };
}

export function planificarInforme(modelo: ModeloInforme): PlanInforme {
  return planSegunLibre(modelo, CUERPO_HOJA.alto - altoEnUltimaHoja(renglonesDelFlujo(modelo)));
}
