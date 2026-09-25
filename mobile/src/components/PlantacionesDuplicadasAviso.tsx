/**
 * Plantaciones que se subieron en este sync y chocan con otra del server por
 * lugar y periodo (#633). No es un error: se subieron igual.
 */
import type { SyncPlantationResult } from '../services/SyncService';
import { nombresDeDuplicadas } from '../services/sync/duplicadasEnServidor';
import GrupoDeAviso from './GrupoDeAviso';

export const TEXTO_DUPLICADA_EN_SERVIDOR =
  'Ya había otra plantación con el mismo lugar y periodo. Si es la misma, revisalo desde la web de gestión.';

export default function PlantacionesDuplicadasAviso({ resultados }: { resultados: SyncPlantationResult[] }) {
  return (
    <GrupoDeAviso
      titulo="Mismo lugar y periodo"
      nombres={nombresDeDuplicadas(resultados)}
      explicacion={TEXTO_DUPLICADA_EN_SERVIDOR}
    />
  );
}
