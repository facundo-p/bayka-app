/**
 * Fixture compartido para tests del listado de plantaciones: configura el
 * resolver del supabaseMock con filas de `plantations` y los contadores que
 * devuelve el RPC agregado `stats_plantaciones` (migración 027).
 */
import { estadoMock } from './supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from './queryBuilderMock';

export type StatsMock = { arboles: number; parcelas: number; usuarios: number };

function resolverStats(statsPorPlantacion: Record<string, StatsMock>): RespuestaMock {
  const filas = Object.entries(statsPorPlantacion).map(([plantationId, stats]) => ({
    plantation_id: plantationId,
    ...stats,
  }));
  return { data: filas, error: null };
}

/** Con filtro por id (detalle, maybeSingle) responde la fila única; sin
 *  filtro (listado) responde todas. */
function resolverPlantations(
  consulta: ConsultaCapturada,
  filas: Array<Record<string, unknown>>,
): RespuestaMock {
  const filtroId = consulta.filtros.find(
    (filtro) => filtro.metodo === 'eq' && filtro.columna === 'id',
  );
  if (!filtroId) return { data: filas, error: null };
  return { data: filas.find((fila) => fila.id === filtroId.valor) ?? null, error: null };
}

export function configurarPlantacionesMock(
  filas: Array<Record<string, unknown>>,
  statsPorPlantacion: Record<string, StatsMock> = {},
): void {
  estadoMock.resolverConsulta = (consulta) => {
    if (consulta.tabla === 'plantations') return resolverPlantations(consulta, filas);
    if (consulta.tabla === 'stats_plantaciones') return resolverStats(statsPorPlantacion);
    // Otras queries durante el render (p.ej. temporada activa): vacío.
    return { data: [], error: null, count: 0 };
  };
}
