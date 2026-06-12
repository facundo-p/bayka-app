/**
 * Fixture compartido para tests del listado de plantaciones: configura el
 * resolver del supabaseMock con filas de `plantations` y counts por plantación.
 */
import { estadoMock } from './supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from './queryBuilderMock';

export type StatsMock = { arboles: number; parcelas: number; usuarios: number };

/** count de cada tabla → campo de stats que representa. */
const STAT_POR_TABLA: Record<string, keyof StatsMock> = {
  trees: 'arboles',
  parcelas: 'parcelas',
  plantation_users: 'usuarios',
};

function resolverCount(
  consulta: ConsultaCapturada,
  statsPorPlantacion: Record<string, StatsMock>,
): RespuestaMock {
  const stat = STAT_POR_TABLA[consulta.tabla];
  if (!stat) throw new Error(`Tabla inesperada en el mock: ${consulta.tabla}`);
  const filtroEq = consulta.filtros.find((filtro) => filtro.metodo === 'eq');
  const stats = statsPorPlantacion[String(filtroEq?.valor)];
  return { count: stats ? stats[stat] : 0, error: null };
}

export function configurarPlantacionesMock(
  filas: Array<Record<string, unknown>>,
  statsPorPlantacion: Record<string, StatsMock> = {},
): void {
  estadoMock.resolverConsulta = (consulta) =>
    consulta.tabla === 'plantations'
      ? { data: filas, error: null }
      : resolverCount(consulta, statsPorPlantacion);
}
