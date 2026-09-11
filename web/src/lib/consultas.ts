import type { UseQueryResult } from '@tanstack/react-query';

/** Lo que una vista necesita de una query para mostrar su estado y reintentarla. */
export type EstadoConsulta = Pick<UseQueryResult<unknown>, 'isPending' | 'isError' | 'refetch'>;

export function algunaCargando(consultas: EstadoConsulta[]): boolean {
  return consultas.some((consulta) => consulta.isPending);
}

export function algunaConError(consultas: EstadoConsulta[]): boolean {
  return consultas.some((consulta) => consulta.isError);
}

/** Un solo botón de reintento para una vista que depende de varias queries. */
export function reintentarTodas(consultas: EstadoConsulta[]): () => void {
  return () => void Promise.all(consultas.map((consulta) => consulta.refetch()));
}
