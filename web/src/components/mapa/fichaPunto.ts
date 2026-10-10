/*
 * Contenido del popup de un punto del mapa: lógica pura, sin el proveedor de mapas.
 */
import { COLOR_GRAFICO_NN } from '../../theme/chartColors';
import type { PuntoGps } from './types';

/** Parcela tal como la nombra el popup. Tipo estructural: no importa de `queries/`. */
export interface ParcelaFicha {
  id: string;
  codigo: string;
  nombre: string;
}

export interface FichaPunto {
  idArbol: string;
  especie: { codigo: string; nombre: string; color: string };
  /** `código · nombre`, o el aviso de que el grupo no tiene parcela. */
  parcela: string;
}

export const SIN_PARCELA = 'Sin parcela';

/** El color del punto es el de su especie en la leyenda; sin entrada, el de N/N. */
export function colorDePunto(punto: PuntoGps, colorPorCodigo: Map<string, string>): string {
  return colorPorCodigo.get(punto.codigo) ?? COLOR_GRAFICO_NN;
}

function nombrarParcela(
  parcelaId: string | null,
  parcelasPorId: Map<string, ParcelaFicha>,
): string {
  const parcela = parcelaId !== null ? parcelasPorId.get(parcelaId) : undefined;
  return parcela ? `${parcela.codigo} · ${parcela.nombre}` : SIN_PARCELA;
}

export function fichaDePunto(
  punto: PuntoGps,
  parcelasPorId: Map<string, ParcelaFicha>,
  colorPorCodigo: Map<string, string>,
): FichaPunto {
  return {
    idArbol: punto.idArbol,
    especie: {
      codigo: punto.codigo,
      nombre: punto.nombre,
      color: colorDePunto(punto, colorPorCodigo),
    },
    parcela: nombrarParcela(punto.parcelaId, parcelasPorId),
  };
}
