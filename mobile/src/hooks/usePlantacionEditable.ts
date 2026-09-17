import { useLiveData } from '../database/liveQuery';
import { getPlantationEstadoDeEdicion } from '../queries/adminQueries';
import { ESTADO_PLANTACION, esArchivada } from '../constants/estados';
import { plantacionEsEditable } from '../utils/permisosDeEdicion';
import type { EstadoDeEdicionDePlantacion } from '../utils/permisosDeEdicion';

/** Plantación que no está en SQLite: sin estado ni archivado, como antes de #477. */
const PLANTACION_SIN_DATOS: EstadoDeEdicionDePlantacion = { estado: '', archivadaEn: null };

/**
 * Si la plantación admite cambios desde la app. Reactivo: un pull que la finaliza
 * o archiva la bloquea con la pantalla abierta. Mientras no cargó, no es editable.
 */
export function usePlantacionEditable(plantacionId: string) {
  const { data } = useLiveData(
    () => getPlantationEstadoDeEdicion(plantacionId).then((e) => [e ?? PLANTACION_SIN_DATOS]),
    [plantacionId],
  );
  const estadoDeEdicion = data?.[0] ?? PLANTACION_SIN_DATOS;
  const estadoLoaded = data !== undefined;
  return {
    estadoDeEdicion,
    estadoLoaded,
    isFinalizada: estadoDeEdicion.estado === ESTADO_PLANTACION.finalizada,
    isArchivada: esArchivada(estadoDeEdicion),
    plantacionEditable: estadoLoaded && plantacionEsEditable(estadoDeEdicion),
  };
}
