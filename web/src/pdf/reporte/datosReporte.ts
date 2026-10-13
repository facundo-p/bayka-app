/*
 * Árbol de la query → tarjeta o fila del reporte, con todo ya formateado: los
 * componentes solo pintan. Puro y testeable sin react-pdf.
 */
import { pluralizar } from '../../lib/formato';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { ArbolParaFicha } from '../../queries/fichasQueries';
import type { ColorEspecie } from '../../theme/coloresEspecie';
import {
  datosArbol,
  especieArbol,
  type ModeloArbol,
  type RotuloEspecie,
} from '../arbol/datosArbol';
import type { FotoPdf } from '../estadoFoto';
import { TEXTO_REPORTE } from './textosReporte';

/** Una fila del listado; la tarjeta suma la foto. De la especie, solo el rótulo y su color. */
export type ModeloArbolReporte = ModeloArbol & { especie: RotuloEspecie };

export type ModeloTarjeta = ModeloArbolReporte & { foto: FotoPdf };

export function datosArbolReporte(
  arbol: ArbolParaFicha,
  colorDe: ColorEspecie,
): ModeloArbolReporte {
  const { color, titulo, sinIdentificar } = especieArbol(arbol.especie, colorDe);
  return { ...datosArbol(arbol), especie: { color, titulo, sinIdentificar } };
}

export function datosTarjeta(
  arbol: ArbolParaFicha,
  foto: FotoPdf,
  colorDe: ColorEspecie,
): ModeloTarjeta {
  return { ...datosArbolReporte(arbol, colorDe), foto };
}

/** Nombre del documento en el pie: «Reporte de árboles · 148 árboles». */
export function documentoDeReporte(cantidad: number): string {
  const { documento, separador } = TEXTO_REPORTE;
  return `${documento}${separador}${pluralizar(cantidad, SUSTANTIVO.arbol)}`;
}
