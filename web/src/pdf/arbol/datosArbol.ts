/*
 * Fila de la query → lo que la ficha y el reporte muestran igual de un árbol,
 * ya formateado: los componentes solo pintan. Puro y testeable sin react-pdf.
 */
import { formatearFechaCorta } from '../../lib/fechas';
import { DECIMALES_GPS, etiquetaEspecie, SIN_DATO } from '../../lib/formato';
import { ETIQUETA_SUBTIPO_ESPECIE, ETIQUETA_TIPO_ESPECIE } from '../../lib/tiposEspecie';
import type {
  ArbolParaFicha,
  CodigoNombre,
  EspecieDeFicha,
  GpsDeFicha,
} from '../../queries/fichasQueries';
import { COLOR_GRAFICO_NN } from '../../theme/chartColors';
import type { ColorEspecie } from '../../theme/coloresEspecie';
import { TEXTO_ARBOL } from './textosArbol';

export type EspecieArbol = {
  color: string;
  /** «ANC · Anchico» o «N/N · Sin identificar». */
  titulo: string;
  cientifico: string | null;
  /** «Flora · Árbol»; null en N/N. */
  clasificacion: string | null;
  sinIdentificar: boolean;
};

/** Lo que va en el renglón de la especie: el punto de color y el rótulo. */
export type RotuloEspecie = Pick<EspecieArbol, 'color' | 'titulo' | 'sinIdentificar'>;

export type GpsArbol = { coordenadas: string; precision: string | null };

/** Lo que la ficha, la tarjeta y la fila del listado muestran igual; la especie la elige cada una. */
export type ModeloArbol = {
  idArbol: string;
  /** null si el grupo no tiene parcela. */
  parcela: CodigoNombre | null;
  grupo: CodigoNombre;
  posicion: string;
  registrado: string;
  /** null sin punto GPS. */
  gps: GpsArbol | null;
};

const ESPECIE_NN: EspecieArbol = {
  color: COLOR_GRAFICO_NN,
  titulo: etiquetaEspecie({ especieCodigo: null, especieNombre: null }),
  cientifico: null,
  clasificacion: null,
  sinIdentificar: true,
};

export function especieArbol(especie: EspecieDeFicha | null, colorDe: ColorEspecie): EspecieArbol {
  if (!especie) return ESPECIE_NN;
  const { separador } = TEXTO_ARBOL;
  return {
    color: colorDe(especie.codigo),
    titulo: etiquetaEspecie({ especieCodigo: especie.codigo, especieNombre: especie.nombre }),
    cientifico: especie.nombreCientifico,
    clasificacion: `${ETIQUETA_TIPO_ESPECIE[especie.tipo]}${separador}${ETIQUETA_SUBTIPO_ESPECIE[especie.subtipo]}`,
    sinIdentificar: false,
  };
}

/** «-27.360120, -55.897440» y «± 4 m». */
export function gpsArbol(gps: GpsDeFicha | null): GpsArbol | null {
  if (!gps) return null;
  const { precision: signo, metros } = TEXTO_ARBOL;
  return {
    coordenadas: `${gps.lat.toFixed(DECIMALES_GPS)}, ${gps.lng.toFixed(DECIMALES_GPS)}`,
    precision: gps.precision == null ? null : `${signo} ${Math.round(gps.precision)} ${metros}`,
  };
}

export function datosArbol(arbol: ArbolParaFicha): ModeloArbol {
  return {
    idArbol: arbol.idArbol,
    parcela: arbol.parcela,
    grupo: arbol.grupo,
    posicion: arbol.posicion == null ? SIN_DATO : String(arbol.posicion),
    registrado: formatearFechaCorta(arbol.createdAt),
    gps: gpsArbol(arbol.gps),
  };
}
