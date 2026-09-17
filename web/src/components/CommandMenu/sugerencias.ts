import { rutaPlantacion } from '../../lib/rutas';
import { ESTADO_PLANTACION, sinArchivadas } from '../../queries/plantationQueries';
import type { PlantacionConStats } from '../../queries/plantationQueries';
import type { ResultadoBusqueda } from '../../queries/buscarQueries';

/** Cantidad de sugerencias del estado vacío (sin recientes). */
const TOPE_SUGERENCIAS = 4;

function aResultado(plantacion: PlantacionConStats): ResultadoBusqueda {
  return {
    tipo: 'plantacion',
    id: plantacion.id,
    titulo: plantacion.lugar,
    meta: plantacion.periodo,
    to: rutaPlantacion(plantacion.id),
  };
}

/** Sugerencias del estado vacío: la temporada activa (más árboles) primero,
 *  luego las últimas plantaciones por fecha de creación. Nunca archivadas. */
export function sugerencias(todas: PlantacionConStats[]): ResultadoBusqueda[] {
  const plantaciones = sinArchivadas(todas);
  if (plantaciones.length === 0) return [];
  const activas = plantaciones.filter(
    (plantacion) => plantacion.estado === ESTADO_PLANTACION.activa,
  );
  const temporada = activas.length
    ? activas.reduce((mejor, actual) => (actual.arboles > mejor.arboles ? actual : mejor))
    : null;
  const recientesPorFecha = [...plantaciones]
    .sort((primera, segunda) => segunda.createdAt.localeCompare(primera.createdAt))
    .filter((plantacion) => plantacion.id !== temporada?.id);
  const elegidas = [...(temporada ? [temporada] : []), ...recientesPorFecha].slice(
    0,
    TOPE_SUGERENCIAS,
  );
  return elegidas.map(aResultado);
}
