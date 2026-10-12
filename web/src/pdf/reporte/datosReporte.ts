/*
 * Árbol de la query → tarjeta o fila del reporte, con todo ya formateado: los
 * componentes solo pintan. Puro y testeable sin react-pdf.
 */
import { formatearFechaCorta } from '../../lib/fechas';
import { pluralizar, SIN_DATO } from '../../lib/formato';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { ArbolParaFicha, CodigoNombre } from '../../queries/fichasQueries';
import type { ColorEspecie } from '../../theme/coloresEspecie';
import type { FotoPdf } from '../estadoFoto';
import { especieFicha, gpsFicha, type EspecieFicha, type GpsFicha } from '../ficha/datosFicha';
import { TEXTO_REPORTE } from './textosReporte';

/** El reporte muestra de la especie solo el rótulo y su color. */
export type EspecieReporte = Pick<EspecieFicha, 'color' | 'titulo' | 'sinIdentificar'>;

/** Una fila del listado; la tarjeta suma la foto. */
export type ModeloArbolReporte = {
  idArbol: string;
  especie: EspecieReporte;
  /** null si el grupo no tiene parcela. */
  parcela: CodigoNombre | null;
  grupo: CodigoNombre;
  posicion: string;
  registrado: string;
  /** null sin punto GPS. */
  gps: GpsFicha | null;
};

export type ModeloTarjeta = ModeloArbolReporte & { foto: FotoPdf };

export function datosArbolReporte(
  arbol: ArbolParaFicha,
  colorDe: ColorEspecie,
): ModeloArbolReporte {
  const { color, titulo, sinIdentificar } = especieFicha(arbol.especie, colorDe);
  return {
    idArbol: arbol.idArbol,
    especie: { color, titulo, sinIdentificar },
    parcela: arbol.parcela,
    grupo: arbol.grupo,
    posicion: arbol.posicion == null ? SIN_DATO : String(arbol.posicion),
    registrado: formatearFechaCorta(arbol.createdAt),
    gps: gpsFicha(arbol.gps),
  };
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
