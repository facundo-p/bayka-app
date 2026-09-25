/**
 * Técnicos que se asignaron en el teléfono y el servidor rechazó (#636). Ya se
 * quitaron de la plantación en el teléfono.
 */
import type { SyncPlantationResult } from '../services/SyncService';
import {
  EXPLICACION_TECNICOS_NO_ASIGNADOS,
  TITULO_AVISO_TECNICOS_NO_ASIGNADOS,
  tecnicosNoAsignadosDe,
} from '../utils/tecnicosDePlantacion';
import GrupoDeAviso from './GrupoDeAviso';

export default function TecnicosNoAsignadosAviso({ resultados }: { resultados: SyncPlantationResult[] }) {
  return (
    <GrupoDeAviso
      titulo={TITULO_AVISO_TECNICOS_NO_ASIGNADOS}
      nombres={tecnicosNoAsignadosDe(resultados)}
      explicacion={EXPLICACION_TECNICOS_NO_ASIGNADOS}
    />
  );
}
