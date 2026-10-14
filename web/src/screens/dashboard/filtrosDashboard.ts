/*
 * Lógica pura de los filtros del dashboard (parcela y especie, combinables):
 * qué puntos ve el mapa, qué cuenta la tira de parcelas y qué nombra el resumen.
 */
import type { DistribucionParcela, FiltrosDashboard } from '../../queries/dashboardQueries';
import type { ParcelaConStats } from '../../queries/dataExplorerQueries';
import { ESPECIE_NO_RESUELTA, esSinIdentificar } from '../../queries/especiesConstantes';
import type { PuntoGps } from '../../queries/mapaQueries';
import type { EspecieColoreada } from './coloresEspecies';
import { TIPO_ALCANCE, type AlcanceMetrica } from './ResumenPlantacion';

/** Elegir lo que ya estaba elegido lo suelta. */
export function alternar(actual: string | null, elegido: string): string | null {
  return actual === elegido ? null : elegido;
}

function sinFiltros({ parcelaId, especieCodigo }: FiltrosDashboard): boolean {
  return parcelaId === null && especieCodigo === null;
}

/** Sin filtros devuelve el MISMO array: si cambia la referencia, el mapa vuelve a
 *  encuadrar aunque no haya filtrado nada. */
export function filtrarPuntos(puntos: PuntoGps[], filtros: FiltrosDashboard): PuntoGps[] {
  if (sinFiltros(filtros)) return puntos;
  const { parcelaId, especieCodigo } = filtros;
  return puntos.filter(
    (punto) =>
      (parcelaId === null || punto.parcelaId === parcelaId) &&
      (especieCodigo === null || punto.codigo === especieCodigo),
  );
}

/** Con una especie elegida, cada parcela de la tira cuenta solo sus árboles de esa especie. */
export function parcelasDeTira(
  parcelas: ParcelaConStats[],
  porParcela: DistribucionParcela[],
  especieCodigo: string | null,
): ParcelaConStats[] {
  if (especieCodigo === null) return parcelas;
  const cantidades = new Map(porParcela.map((parcela) => [parcela.id, parcela.cantidad]));
  return parcelas.map((parcela) => ({ ...parcela, arboles: cantidades.get(parcela.id) ?? 0 }));
}

/** Lo que nombra el resumen: la parcela y la especie elegidas, en ese orden. */
export function armarAlcance(
  parcela: ParcelaConStats | null,
  especie: EspecieColoreada | undefined,
  onVerTodos: () => void,
): AlcanceMetrica | undefined {
  const selecciones = [
    ...(parcela
      ? [{ tipo: TIPO_ALCANCE.parcela, codigo: parcela.codigo, nombre: parcela.nombre }]
      : []),
    ...(especie
      ? [
          {
            tipo: TIPO_ALCANCE.especie,
            codigo: especie.codigo,
            nombre: especie.nombre,
            color: especie.color,
          },
        ]
      : []),
  ];
  return selecciones.length > 0 ? { selecciones, onVerTodos } : undefined;
}

/** Cómo nombra el mapa a la especie elegida: los N/N no tienen nombre propio. */
export function etiquetaEspecie({ codigo, nombre }: Pick<EspecieColoreada, 'codigo' | 'nombre'>) {
  return esSinIdentificar(codigo) ? ESPECIE_NO_RESUELTA : nombre;
}
