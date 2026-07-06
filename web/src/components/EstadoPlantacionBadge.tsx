import { Badge } from './Badge';
import type { EstadoPlantacion } from '../queries/plantationQueries';

/* Etiquetas en español de los estados de plantación. */
const ETIQUETA_ESTADO: Record<EstadoPlantacion, string> = {
  activa: 'Activa',
  finalizada: 'Finalizada',
};

/** Badge del estado de una plantación (un solo lugar para etiqueta y color). */
export function EstadoPlantacionBadge({ estado }: { estado: EstadoPlantacion }) {
  return <Badge variant={estado}>{ETIQUETA_ESTADO[estado]}</Badge>;
}
