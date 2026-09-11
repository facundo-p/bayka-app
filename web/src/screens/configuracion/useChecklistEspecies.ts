import { useMemo, useState } from 'react';
import {
  accionDesdeEstado,
  avisoBloqueadas,
  estadoMaestro,
  filtrarCatalogo,
  planificarAccionMasiva,
  type ContextoSeleccion,
} from '../../lib/speciesChecklistSelection';
import type { EspecieCatalogo, EspecieConUso } from '../../queries/especieQueries';
import { useSincronizarEspecies, useToggleEspecie } from './useMutacionesEspecies';

const MENSAJE_ERROR_GUARDAR = 'No se pudo guardar el cambio de especie.';

function useContextoSeleccion(
  catalogo: EspecieCatalogo[],
  especies: EspecieConUso[],
  busqueda: string,
): ContextoSeleccion {
  const habilitadas = useMemo(() => new Set(especies.map((especie) => especie.id)), [especies]);
  // Con árboles registrados no se pueden desmarcar (paridad mobile).
  const bloqueadas = useMemo(
    () => new Set(especies.filter((especie) => especie.tieneArboles).map((especie) => especie.id)),
    [especies],
  );
  const idsVisibles = useMemo(
    () => filtrarCatalogo(catalogo, busqueda).map((especie) => especie.id),
    [catalogo, busqueda],
  );
  return { idsVisibles, habilitadas, bloqueadas };
}

/** El maestro opera sobre las visibles y avisa cuántas bloqueadas quedaron marcadas. */
function useAccionMasiva(
  plantationId: string,
  catalogo: EspecieCatalogo[],
  contexto: ContextoSeleccion,
  ordenInicial: number,
) {
  const [aviso, setAviso] = useState<string | null>(null);
  const sincronizar = useSincronizarEspecies(plantationId, catalogo);
  const estado = estadoMaestro(contexto);
  const alternarTodas = () => {
    const { idsHabilitar, idsQuitar, bloqueadasMantenidas } = planificarAccionMasiva(
      contexto,
      accionDesdeEstado(estado),
    );
    setAviso(bloqueadasMantenidas > 0 ? avisoBloqueadas(bloqueadasMantenidas) : null);
    if (idsHabilitar.length === 0 && idsQuitar.length === 0) return;
    sincronizar.mutate({ idsHabilitar, idsQuitar, ordenInicial });
  };
  return {
    estado,
    aviso,
    limpiarAviso: () => setAviso(null),
    alternarTodas,
    fallo: sincronizar.isError,
  };
}

/** Estado del checklist de especies de una plantación: búsqueda, maestro y guardado. */
export function useChecklistEspecies(
  plantationId: string,
  catalogo: EspecieCatalogo[],
  especies: EspecieConUso[],
) {
  const [busqueda, setBusqueda] = useState('');
  const contexto = useContextoSeleccion(catalogo, especies, busqueda);
  const { limpiarAviso, fallo, ...masiva } = useAccionMasiva(
    plantationId,
    catalogo,
    contexto,
    especies.length,
  );
  const toggle = useToggleEspecie(plantationId, catalogo);
  const alternar = (speciesId: string, habilitar: boolean) => {
    limpiarAviso();
    toggle.mutate({ speciesId, habilitar, orden: especies.length });
  };
  const mensajeError = toggle.isError || fallo ? MENSAJE_ERROR_GUARDAR : null;
  return { ...masiva, busqueda, setBusqueda, contexto, alternar, mensajeError };
}
