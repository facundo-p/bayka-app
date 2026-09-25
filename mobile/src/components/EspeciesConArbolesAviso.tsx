/**
 * Especies que se quitaron en el teléfono y el servidor mantuvo porque ya tienen
 * árboles (#635). Quedan habilitadas de nuevo en el teléfono.
 */
import type { SyncPlantationResult } from '../services/SyncService';
import { especiesConArbolesDe } from '../utils/cambiosDeEspecies';
import GrupoDeAviso from './GrupoDeAviso';

export const TEXTO_ESPECIES_CON_ARBOLES =
  'Estas especies ya tienen árboles registrados en el servidor, así que siguen habilitadas.';

export default function EspeciesConArbolesAviso({ resultados }: { resultados: SyncPlantationResult[] }) {
  return (
    <GrupoDeAviso
      titulo="Especies que no se quitaron"
      nombres={especiesConArbolesDe(resultados)}
      explicacion={TEXTO_ESPECIES_CON_ARBOLES}
    />
  );
}
