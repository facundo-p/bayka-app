/*
 * Nombre del archivo del reporte de árboles (#849). Los filtros van en el
 * nombre y no en el documento: es lo único que dice qué árboles trae.
 */
import type { FiltrosArboles } from '../queries/dataExplorerQueries';
import { ESPECIE_SIN_IDENTIFICAR } from '../queries/especiesConstantes';
import { EXTENSION_PDF, nombreArchivoDescarga } from './descargas';

const PREFIJO_ARCHIVO_REPORTE = 'arboles';

/** Cómo se lee cada filtro en el nombre; el slug los pasa a minúsculas con guiones. */
const PARTE_FILTRO = {
  conGps: 'con GPS',
  sinGps: 'sin GPS',
  conFoto: 'con foto',
  sinFoto: 'sin foto',
  busqueda: 'ID',
} as const;

type ConCodigo = { id: string; codigo: string };

/** De dónde salen los códigos de los filtros, que guardan ids. */
export type CatalogosDelNombre = {
  parcelas: readonly ConCodigo[];
  grupos: readonly ConCodigo[];
  especies: readonly ConCodigo[];
};

/** Un id que el catálogo no tiene no suma nada: un uuid no le dice nada a nadie. */
function codigoDe(id: string | undefined, catalogo: readonly ConCodigo[]): string | undefined {
  return id ? catalogo.find((fila) => fila.id === id)?.codigo : undefined;
}

/** «Sin identificar» se escribe con su código, NN: el slug de «N/N» sería `n-n`. */
function codigoEspecie(speciesId: string | undefined, especies: readonly ConCodigo[]) {
  return speciesId === ESPECIE_SIN_IDENTIFICAR
    ? ESPECIE_SIN_IDENTIFICAR
    : codigoDe(speciesId, especies);
}

function parteSiNo(valor: boolean | undefined, si: string, no: string): string | undefined {
  if (valor === undefined) return undefined;
  return valor ? si : no;
}

function partesDelFiltro(filtros: FiltrosArboles, catalogos: CatalogosDelNombre) {
  return [
    codigoDe(filtros.parcelaId, catalogos.parcelas),
    codigoDe(filtros.groupId, catalogos.grupos),
    codigoEspecie(filtros.speciesId, catalogos.especies),
    parteSiNo(filtros.conGps, PARTE_FILTRO.conGps, PARTE_FILTRO.sinGps),
    parteSiNo(filtros.conFoto, PARTE_FILTRO.conFoto, PARTE_FILTRO.sinFoto),
    filtros.busqueda && `${PARTE_FILTRO.busqueda} ${filtros.busqueda}`,
  ];
}

/** `arboles-<lugar>-<periodo>[-<parcela>-<grupo>-<especie>-<gps>-<foto>-id-<búsqueda>].pdf`. */
export function nombreArchivoReporte(
  lugar: string,
  periodo: string,
  filtros: FiltrosArboles,
  catalogos: CatalogosDelNombre,
): string {
  const detalle = partesDelFiltro(filtros, catalogos).filter(Boolean).join(' ');
  return nombreArchivoDescarga(PREFIJO_ARCHIVO_REPORTE, lugar, periodo, EXTENSION_PDF, detalle);
}
