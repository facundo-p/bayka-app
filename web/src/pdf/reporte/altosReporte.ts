/*
 * Lo que mide cada tarjeta y cada fila del listado con sus textos ya en
 * renglones, sin renderizar: con esto `paginarReporte` llena cada hoja. Sale de
 * las mismas medidas que los estilos.
 */
import {
  ALTO_RENGLON_REPORTE as ALTO,
  altoConRenglones,
  CAJA_TARJETA,
  MEDIDA_REPORTE as M,
} from '../plantilla/tokens';
import type { AltosReporte } from './planReporte';
import type {
  CampoEnRenglones,
  CodigoEnRenglones,
  FilaEnRenglones,
  TarjetaEnRenglones,
} from './renglonesReporte';

/** Lo único que cambia el alto: los textos que se parten. */
export type TextosDelAlto = Pick<FilaEnRenglones, CampoEnRenglones>;

/** Sin parcela va «—», en un renglón. */
const renglonesDe = (entidad: CodigoEnRenglones | null) => entidad?.nombre.length ?? 1;

/** La fila mide lo que su celda con más renglones. */
export function altoFila({ idArbol, especie, parcela, grupo }: TextosDelAlto): number {
  const renglones = Math.max(
    idArbol.length,
    especie.titulo.length,
    renglonesDe(parcela),
    renglonesDe(grupo),
  );
  return altoConRenglones(M.altoFilaListado, ALTO.fila, renglones);
}

/** Posición, registrado y GPS: de formato fijo, siempre en un renglón. */
const DATOS_DE_UN_RENGLON = 3;

function altoDatos({ idArbol, especie, parcela, grupo }: TextosDelAlto): number {
  const altoEspecie = M.altoEspecie + 2 * M.aireEspecie;
  return (
    altoConRenglones(M.altoIdArbol, ALTO.idTarjeta, idArbol.length) +
    altoConRenglones(altoEspecie, ALTO.especieTarjeta, especie.titulo.length) +
    altoConRenglones(M.altoDato, ALTO.dato, renglonesDe(parcela)) +
    altoConRenglones(M.altoDato, ALTO.dato, renglonesDe(grupo)) +
    DATOS_DE_UN_RENGLON * M.altoDato
  );
}

/** La tarjeta mide lo que sus datos; la foto, de lado fijo, le pone el piso. */
export function altoTarjeta(tarjeta: TextosDelAlto): number {
  const marco = 2 * (M.rellenoTarjeta + M.borde);
  return Math.max(CAJA_TARJETA.alto, altoDatos(tarjeta) + marco);
}

export const ALTOS_EN_RENGLONES: AltosReporte<TarjetaEnRenglones, FilaEnRenglones> = {
  tarjeta: altoTarjeta,
  fila: altoFila,
};
