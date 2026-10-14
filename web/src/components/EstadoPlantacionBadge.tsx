import { Badge } from './Badge';
import { ETIQUETA_ESTADO_PLANTACION, type EstadoPlantacion } from '../queries/plantationQueries';

/** Badge del estado de una plantación (un solo lugar para etiqueta y color). */
export function EstadoPlantacionBadge({ estado }: { estado: EstadoPlantacion }) {
  return (
    <Badge variant={estado} dot>
      {ETIQUETA_ESTADO_PLANTACION[estado]}
    </Badge>
  );
}
