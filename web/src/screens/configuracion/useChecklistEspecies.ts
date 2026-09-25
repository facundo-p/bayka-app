import { useMemo, useState } from 'react';
import {
  accionDesdeEstado,
  avisoBloqueadas,
  estadoMaestro,
  filtrarCatalogo,
  planificarAccionMasiva,
  type ContextoSeleccion,
  type PlanSeleccion,
} from '../../lib/speciesChecklistSelection';
import type { EspecieCatalogo, EspecieConUso } from '../../queries/especieQueries';
import { useSincronizarEspecies, useToggleEspecie } from './useMutacionesEspecies';

const MENSAJE_ERROR_GUARDAR = 'No se pudo guardar el cambio de especie.';

export interface DatosChecklist {
  plantationId: string;
  catalogo: EspecieCatalogo[];
  especies: EspecieConUso[];
}

function useContextoSeleccion(datos: DatosChecklist, busqueda: string): ContextoSeleccion {
  const { catalogo, especies } = datos;
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

function avisoDelPlan({ bloqueadasMantenidas }: PlanSeleccion): string | null {
  return bloqueadasMantenidas > 0 ? avisoBloqueadas(bloqueadasMantenidas) : null;
}

/** El maestro opera sobre las visibles y avisa cuántas bloqueadas quedaron marcadas. */
function useAccionMasiva(datos: DatosChecklist, contexto: ContextoSeleccion) {
  const [aviso, setAviso] = useState<string | null>(null);
  const sincronizar = useSincronizarEspecies(datos.plantationId, datos.catalogo);
  const estado = estadoMaestro(contexto);
  const alternarTodas = () => {
    const plan = planificarAccionMasiva(contexto, accionDesdeEstado(estado));
    setAviso(avisoDelPlan(plan));
    const { idsHabilitar, idsQuitar } = plan;
    if (idsHabilitar.length === 0 && idsQuitar.length === 0) return;
    sincronizar.mutate({ idsHabilitar, idsQuitar });
  };
  const limpiarAviso = () => setAviso(null);
  return { estado, aviso, limpiarAviso, alternarTodas, fallo: sincronizar.error };
}

/** Estado del checklist de especies de una plantación: búsqueda, maestro y guardado. */
export function useChecklistEspecies(datos: DatosChecklist) {
  const [busqueda, setBusqueda] = useState('');
  const contexto = useContextoSeleccion(datos, busqueda);
  const { limpiarAviso, fallo, ...masiva } = useAccionMasiva(datos, contexto);
  const toggle = useToggleEspecie(datos.plantationId, datos.catalogo);
  const alternar = (speciesId: string, habilitar: boolean) => {
    limpiarAviso();
    toggle.mutate({ speciesId, habilitar });
  };
  // El motivo del server (p. ej. la especie ya tiene árboles) dice más que un error genérico.
  const error = toggle.error ?? fallo;
  const mensajeError = error ? error.message || MENSAJE_ERROR_GUARDAR : null;
  return { ...masiva, busqueda, setBusqueda, contexto, alternar, mensajeError };
}
