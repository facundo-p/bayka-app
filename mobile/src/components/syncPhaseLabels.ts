/**
 * Nombres de las fases de sincronización que ve el usuario. Compartidos por el modal
 * de sync y el de descarga de catálogo, que recorren las mismas fases.
 */
import { DOWNLOAD_PHASE } from '../services/SyncService';
import type { DownloadPhase, DownloadPhaseProgress } from '../services/SyncService';

export const PHASE_LABEL: Record<DownloadPhase, string> = {
  [DOWNLOAD_PHASE.species]: 'Catálogo de especies',
  [DOWNLOAD_PHASE.parcelas]: 'Parcelas',
  [DOWNLOAD_PHASE.groups]: 'Grupos',
  [DOWNLOAD_PHASE.usuarios]: 'Usuarios',
  [DOWNLOAD_PHASE.especiesPlantacion]: 'Especies asignadas',
  [DOWNLOAD_PHASE.arboles]: 'Árboles',
  [DOWNLOAD_PHASE.fotos]: 'Fotos',
  [DOWNLOAD_PHASE.finalizando]: 'Finalizando',
};

/**
 * "3.000 de 12.000", o "3.000 filas" mientras se baja y todavía no se sabe el total.
 * Vacío cuando no hay nada que contar, para no mostrar un "0 de 0".
 */
export function contadorDeFase(fase: DownloadPhaseProgress): string {
  if (fase.descargando) return fase.phaseDone > 0 ? `${fase.phaseDone} filas` : '';
  return fase.phaseTotal > 0 ? `${fase.phaseDone} de ${fase.phaseTotal}` : '';
}

/** Fracción para la barra; 0 mientras no haya denominador conocido. */
export function fraccionDeFase(fase: DownloadPhaseProgress | null | undefined): number {
  if (!fase || fase.phaseTotal <= 0) return 0;
  return fase.phaseDone / fase.phaseTotal;
}
