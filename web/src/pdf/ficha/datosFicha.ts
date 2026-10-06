/*
 * Fila de la query → modelo de la ficha, con todo ya formateado: el componente
 * solo pinta. Puro y testeable sin react-pdf.
 */
import { formatearFechaCorta } from '../../lib/fechas';
import { etiquetaEspecie, pluralizar, SIN_DATO } from '../../lib/formato';
import { SUSTANTIVO } from '../../lib/sustantivos';
import { ETIQUETA_SUBTIPO_ESPECIE, ETIQUETA_TIPO_ESPECIE } from '../../lib/tiposEspecie';
import type {
  ArbolParaFicha,
  CodigoNombre,
  EspecieDeFicha,
  GpsDeFicha,
} from '../../queries/fichasQueries';
import { colorEspeciePorCodigo } from '../../theme/coloresEspecie';
import type { FotoPdf } from '../estadoFoto';
import { MAPA_SIN_GPS, type MapaPdf } from '../mapa/estadoMapa';
import { TEXTO_FICHA } from './textosFicha';

const DECIMALES_GPS = 6;

export type EspecieFicha = {
  color: string;
  /** «ANC · Anchico» o «N/N · Sin identificar». */
  titulo: string;
  cientifico: string | null;
  /** «Flora · Árbol»; null en N/N. */
  clasificacion: string | null;
  sinIdentificar: boolean;
};

export type GpsFicha = { coordenadas: string; precision: string | null };

export type ModeloFicha = {
  subId: string;
  idArbol: string;
  /** null mientras no se generaron los IDs. */
  idGlobal: string | null;
  especie: EspecieFicha;
  /** null si el grupo no tiene parcela. */
  parcela: CodigoNombre | null;
  grupo: CodigoNombre;
  posicion: string;
  registrado: string;
  tecnico: string;
  /** null sin punto GPS. */
  gps: GpsFicha | null;
  foto: FotoPdf;
  mapa: MapaPdf;
};

export type ContextoFicha = { tecnico: string | null; foto: FotoPdf; mapa: MapaPdf };

const ESPECIE_FICHA_NN: EspecieFicha = {
  color: colorEspeciePorCodigo(null),
  titulo: etiquetaEspecie({ especieCodigo: null, especieNombre: null }),
  cientifico: null,
  clasificacion: null,
  sinIdentificar: true,
};

export function especieFicha(especie: EspecieDeFicha | null): EspecieFicha {
  if (!especie) return ESPECIE_FICHA_NN;
  const { separador } = TEXTO_FICHA;
  return {
    color: colorEspeciePorCodigo(especie.codigo),
    titulo: etiquetaEspecie({ especieCodigo: especie.codigo, especieNombre: especie.nombre }),
    cientifico: especie.nombreCientifico,
    clasificacion: `${ETIQUETA_TIPO_ESPECIE[especie.tipo]}${separador}${ETIQUETA_SUBTIPO_ESPECIE[especie.subtipo]}`,
    sinIdentificar: false,
  };
}

/** «-27.360120, -55.897440» y «± 4 m». */
export function gpsFicha(gps: GpsDeFicha | null): GpsFicha | null {
  if (!gps) return null;
  const { precision: signo, metros } = TEXTO_FICHA;
  return {
    coordenadas: `${gps.lat.toFixed(DECIMALES_GPS)}, ${gps.lng.toFixed(DECIMALES_GPS)}`,
    precision: gps.precision == null ? null : `${signo} ${Math.round(gps.precision)} ${metros}`,
  };
}

export function datosFicha(arbol: ArbolParaFicha, contexto: ContextoFicha): ModeloFicha {
  return {
    subId: arbol.subId,
    idArbol: arbol.idArbol,
    // Es un identificador: sin separador de miles.
    idGlobal: arbol.idGlobal == null ? null : String(arbol.idGlobal),
    especie: especieFicha(arbol.especie),
    parcela: arbol.parcela,
    grupo: arbol.grupo,
    posicion: arbol.posicion == null ? SIN_DATO : String(arbol.posicion),
    registrado: formatearFechaCorta(arbol.createdAt),
    tecnico: contexto.tecnico ?? SIN_DATO,
    gps: gpsFicha(arbol.gps),
    foto: contexto.foto,
    mapa: arbol.gps ? contexto.mapa : MAPA_SIN_GPS,
  };
}

/** Nombre del documento en el pie: «Ficha de árbol» o «Fichas de árboles · 12 árboles». */
export function documentoDeFichas(cantidad: number): string {
  if (cantidad === 1) return TEXTO_FICHA.documentoUno;
  return `${TEXTO_FICHA.documentoVarias}${TEXTO_FICHA.separador}${pluralizar(cantidad, SUSTANTIVO.arbol)}`;
}
