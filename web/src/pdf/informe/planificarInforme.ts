/*
 * Dónde va el mapa del informe. Todo lo demás fluye y react-pdf lo parte en
 * hojas; acá se simula ese flujo con los altos fijos de los renglones para
 * saber cuánto queda libre en la última hoja.
 */
import { CUERPO_HOJA, MEDIDA_INFORME as M } from '../plantilla/tokens';
import type { Caja } from './mapaInforme';
import type { ModeloInforme } from './datosInforme';

export const UBICACION_MAPA = {
  /** Al pie de la última hoja, en lo que queda libre. */
  ultimaHoja: 'ultima-hoja',
  /** Sola en una hoja nueva al final, con su título. */
  hojaCompleta: 'hoja-completa',
} as const;

export type UbicacionMapa = (typeof UBICACION_MAPA)[keyof typeof UBICACION_MAPA];

export type PlanInforme = { ubicacion: UbicacionMapa; disponible: Caja };

export function esMapaEnHojaCompleta(plan: PlanInforme): boolean {
  return plan.ubicacion === UBICACION_MAPA.hojaCompleta;
}

const ALTO_ENCABEZADO_BLOQUE =
  M.altoEncabezadoBloque + M.aireEncabezadoBloque + M.separacionEncabezadoBloque;

/** Lo que ocupa cada renglón que no se parte, en el orden del documento. */
function renglonesDelFlujo(modelo: ModeloInforme): number[] {
  const { especies, parcelas } = modelo;
  const filaEspecie = M.altoFilaEspecie + M.separacionFilaEspecie;
  const tabla = parcelas.vacio
    ? [M.altoMensaje]
    : [M.altoEncabezadoTabla, ...parcelas.filas.map(() => M.altoFilaTabla), M.altoFilaTabla];
  return [
    M.altoTitulo + M.aireTitulo + M.altoLineaTitulo + M.separacionBloques,
    M.altoIndicadores + M.separacionBloques,
    ALTO_ENCABEZADO_BLOQUE,
    ...(especies.vacio ? [M.altoMensaje] : especies.filas.map(() => filaEspecie)),
    M.separacionBloques + ALTO_ENCABEZADO_BLOQUE,
    ...tabla,
  ];
}

/** Alto ocupado en la última hoja: un renglón que no entra empieza la hoja siguiente. */
export function altoEnUltimaHoja(renglones: readonly number[]): number {
  return renglones.reduce(
    (ocupado, alto) => (ocupado + alto > CUERPO_HOJA.alto ? alto : ocupado + alto),
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

/** Al pie de la última hoja: título de bloque, mapa, leyenda y la nota de los sin GPS. */
function planEnUltimaHoja(modelo: ModeloInforme, libre: number): PlanInforme | null {
  const acompana = M.separacionBloques + ALTO_ENCABEZADO_BLOQUE + altoLeyenda(modelo);
  const alto = libre - acompana - M.aireMapa - M.altoNotaMapa - M.holgura;
  if (alto < M.altoMinimoMapa) return null;
  return { ubicacion: UBICACION_MAPA.ultimaHoja, disponible: { ancho: CUERPO_HOJA.ancho, alto } };
}

/** En hoja propia: título y nota arriba, mapa y leyenda debajo. */
function planEnHojaCompleta(modelo: ModeloInforme): PlanInforme {
  const titulo = M.altoTituloMapa + M.aireTitulo + M.altoLineaTitulo + M.aireTituloMapa;
  const alto = CUERPO_HOJA.alto - titulo - altoLeyenda(modelo) - M.holgura;
  return { ubicacion: UBICACION_MAPA.hojaCompleta, disponible: { ancho: CUERPO_HOJA.ancho, alto } };
}

export function planificarInforme(modelo: ModeloInforme): PlanInforme {
  const libre = CUERPO_HOJA.alto - altoEnUltimaHoja(renglonesDelFlujo(modelo));
  return planEnUltimaHoja(modelo, libre) ?? planEnHojaCompleta(modelo);
}
