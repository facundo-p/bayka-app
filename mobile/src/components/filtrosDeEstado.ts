import { colors } from '../theme';
import { ESTADO_PLANTACION } from '../constants/estados';
import type { ConteoPorEstado } from '../utils/conteoPorEstado';
import type { FilterConfig } from './FilterCards';

export function filtrosDeEstado(conteo: ConteoPorEstado): FilterConfig[] {
  return [
    {
      key: ESTADO_PLANTACION.activa,
      label: 'Activas',
      count: conteo[ESTADO_PLANTACION.activa],
      color: colors.stateActiva,
      icon: 'leaf-outline',
    },
    {
      key: ESTADO_PLANTACION.finalizada,
      label: 'Finalizadas',
      count: conteo[ESTADO_PLANTACION.finalizada],
      color: colors.stateFinalizada,
      icon: 'lock-closed-outline',
    },
  ];
}
