/*
 * Fila de la query → modelo de la ficha, con todo ya formateado: el componente
 * solo pinta. Puro y testeable sin react-pdf.
 */
import { SIN_DATO } from '../../lib/formato';
import type { ArbolParaFicha } from '../../queries/fichasQueries';
import type { ColorEspecie } from '../../theme/coloresEspecie';
import { datosArbol, especieArbol, type EspecieArbol, type ModeloArbol } from '../arbol/datosArbol';
import type { FotoPdf } from '../estadoFoto';
import { MAPA_SIN_GPS, type MapaPdf } from '../mapa/estadoMapa';

/** La ficha suma a lo del árbol la especie completa, el técnico, la foto y el minimapa. */
export type ModeloFicha = ModeloArbol & {
  subId: string;
  especie: EspecieArbol;
  tecnico: string;
  foto: FotoPdf;
  mapa: MapaPdf;
};

export type ContextoFicha = {
  tecnico: string | null;
  foto: FotoPdf;
  mapa: MapaPdf;
  /** Colores de especie de la plantación, los mismos del mapa. */
  colorDe: ColorEspecie;
};

export function datosFicha(arbol: ArbolParaFicha, contexto: ContextoFicha): ModeloFicha {
  return {
    ...datosArbol(arbol),
    subId: arbol.subId,
    especie: especieArbol(arbol.especie, contexto.colorDe),
    tecnico: contexto.tecnico ?? SIN_DATO,
    foto: contexto.foto,
    mapa: arbol.gps ? contexto.mapa : MAPA_SIN_GPS,
  };
}
