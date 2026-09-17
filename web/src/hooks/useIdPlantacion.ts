import { useParams } from 'react-router';
import { PARAM_ID_PLANTACION } from '../lib/rutas';

/** Id de la plantación del detalle, también desde sus tabs anidadas. Fuera de
 *  esa ruta es `''` y no `undefined`: los hooks del detalle reciben `string`. */
export function useIdPlantacion(): string {
  return useParams()[PARAM_ID_PLANTACION] ?? '';
}
