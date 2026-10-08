import { useMemo } from 'react';
import { useLiveData } from '../database/liveQuery';
import { conflictosDeSyncDeGrupo } from '../queries/conflictosDeSyncQueries';
import { conflictosDelGrupo, textoDeAvisoDeGrupo } from '../utils/seccionesDeConflictos';
import { useIrAResolverCambios } from './useIrAResolverCambios';

/** Los conflictos de sincronización de un grupo (#804): el aviso, los árboles marcados y la salida a resolverlos. */
export function useConflictosDeGrupo(grupoId: string, plantacionId: string) {
  const irAResolverCambios = useIrAResolverCambios();
  const { data } = useLiveData(() => conflictosDeSyncDeGrupo(grupoId), [grupoId]);
  const conflictos = useMemo(() => conflictosDelGrupo(data ?? []), [data]);
  return {
    aviso: textoDeAvisoDeGrupo(conflictos),
    arbolesConCambios: conflictos.arboles,
    resolver: () => irAResolverCambios(plantacionId),
  };
}
