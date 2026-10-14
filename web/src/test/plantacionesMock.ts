/**
 * Fixture compartido para tests del listado de plantaciones: configura el
 * resolver del supabaseMock con filas de `plantations` (armadas con
 * `filaPlantacion` de fabricas.ts) y los contadores que devuelve el RPC
 * agregado `stats_plantaciones` (migración 078).
 */
import type { FilaPlantacion } from '../queries/plantationQueries';
import type { PerfilResumen } from '../queries/usuarioQueries';
import { estadoMock } from './supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from './queryBuilderMock';

/** Fila del RPC; lo que falta va en cero o vacío. */
export type StatsMock = Partial<{
  arboles: number;
  parcelas: number;
  puntos_gps: number;
  fotos: number;
  tecnicos: string[];
}>;

const STATS_VACIAS: Required<StatsMock> = {
  arboles: 0,
  parcelas: 0,
  puntos_gps: 0,
  fotos: 0,
  tecnicos: [],
};

function resolverStats(statsPorPlantacion: Record<string, StatsMock>): RespuestaMock {
  const filas = Object.entries(statsPorPlantacion).map(([plantationId, stats]) => ({
    plantation_id: plantationId,
    ...STATS_VACIAS,
    ...stats,
  }));
  return { data: filas, error: null };
}

/** Con filtro por id (detalle, maybeSingle) responde la fila única; sin
 *  filtro (listado) responde todas. */
function resolverPlantations(consulta: ConsultaCapturada, filas: FilaPlantacion[]): RespuestaMock {
  const filtroId = consulta.filtros.find(
    (filtro) => filtro.metodo === 'eq' && filtro.columna === 'id',
  );
  if (!filtroId) return { data: filas, error: null };
  return { data: filas.find((fila) => fila.id === filtroId.valor) ?? null, error: null };
}

/** `perfiles` responde a `profiles`: de ahí salen las opciones de «Visible por». */
export function configurarPlantacionesMock(
  filas: FilaPlantacion[],
  statsPorPlantacion: Record<string, StatsMock> = {},
  perfiles: PerfilResumen[] = [],
): void {
  estadoMock.resolverConsulta = (consulta) => {
    if (consulta.tabla === 'plantations') return resolverPlantations(consulta, filas);
    if (consulta.tabla === 'stats_plantaciones') return resolverStats(statsPorPlantacion);
    if (consulta.tabla === 'profiles') return { data: perfiles, error: null };
    // Otras queries durante el render (p.ej. temporada activa): vacío.
    return { data: [], error: null, count: 0 };
  };
}
