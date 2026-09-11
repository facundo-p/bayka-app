import type { ReactNode } from 'react';
import { Cargando } from './Cargando';
import { EmptyState } from './EmptyState';
import { ErrorConReintento } from './ErrorConReintento';

/** Lo que se lee de un `useQuery` de listado. */
export interface ConsultaListado {
  data: readonly unknown[] | undefined;
  isPending: boolean;
  isError: boolean;
  refetch: () => unknown;
}

export interface TextosConsulta {
  error: string;
  vacio: { titulo: string; descripcion: string };
}

interface EstadoConsultaProps {
  consulta: ConsultaListado;
  textos: TextosConsulta;
  /** El listado: se muestra solo si la consulta trajo filas. */
  children: ReactNode;
}

/**
 * Cargando, error o vacío de un listado. Si falla un refetch con datos previos
 * sigue el listado: los datos de antes sirven más que un cartel de error.
 */
export function EstadoConsulta({ consulta, textos, children }: EstadoConsultaProps) {
  const { data, isPending, isError, refetch } = consulta;
  if (isPending) return <Cargando />;
  if (!data) {
    return isError ? (
      <ErrorConReintento mensaje={textos.error} onReintentar={() => void refetch()} />
    ) : null;
  }
  if (data.length === 0) {
    return <EmptyState title={textos.vacio.titulo} description={textos.vacio.descripcion} />;
  }
  return children;
}
