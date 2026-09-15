/**
 * La prioridad entre fases decide qué ve el técnico durante una sync larga (#447).
 * Vivía adentro de un callback del hook, donde ningún test la alcanzaba.
 */
import { faseDeProgresoGlobal } from '../../src/services/sync/faseDeProgreso';
import { PHOTO_PHASE, DOWNLOAD_PHASE } from '../../src/services/sync/types';
import type { GlobalSyncProgress } from '../../src/services/sync/types';

const base: GlobalSyncProgress = { plantationName: 'La Lomada', plantationDone: 0, plantationTotal: 2 };

describe('faseDeProgresoGlobal', () => {
  it('sin nada más, arranca en pull', () => {
    expect(faseDeProgresoGlobal(base).state).toBe('pulling');
  });

  it('con fase de pull reporta pulling y la fase', () => {
    const fase = { phase: DOWNLOAD_PHASE.arboles, phaseDone: 300, phaseTotal: 1200 };
    const r = faseDeProgresoGlobal({ ...base, phaseProgress: fase });
    expect(r.state).toBe('pulling');
    expect(r.phaseProgress).toBe(fase);
  });

  it('los grupos ganan sobre el pull y limpian la fase', () => {
    const r = faseDeProgresoGlobal({
      ...base,
      phaseProgress: { phase: DOWNLOAD_PHASE.arboles, phaseDone: 300, phaseTotal: 1200 },
      subgroupProgress: { total: 3, completed: 1, currentName: 'Línea A' },
    });
    expect(r.state).toBe('pushing');
    expect(r.phaseProgress).toBeNull();
  });

  it('las fotos ganan sobre los grupos', () => {
    const r = faseDeProgresoGlobal({
      ...base,
      subgroupProgress: { total: 3, completed: 1, currentName: 'Línea A' },
      photoProgress: { total: 40, completed: 12 },
      photoPhase: PHOTO_PHASE.uploading,
    });
    expect(r.state).toBe('uploading-photos');
  });

  it('distingue subida de bajada', () => {
    const fotos = { total: 40, completed: 12 };
    expect(faseDeProgresoGlobal({ ...base, photoProgress: fotos, photoPhase: PHOTO_PHASE.downloading }).state)
      .toBe('downloading-photos');
  });

  // Un `{ total: 0 }` es truthy y hacía saltar el modal a "Subiendo fotos... 0 de 0".
  it('un progreso de fotos vacío no gana la prioridad', () => {
    const r = faseDeProgresoGlobal({
      ...base,
      subgroupProgress: { total: 3, completed: 1, currentName: 'Línea A' },
      photoProgress: { total: 0, completed: 0 },
      photoPhase: PHOTO_PHASE.uploading,
    });
    expect(r.state).toBe('pushing');
  });
});
