/**
 * El sync está lleno de `catch` de "seguir ante fallas": una parcela que falla no
 * frena a las demás, un pull que falla no frena al push. Sin re-lanzar, esos catch
 * se tragan la cancelación y el usuario aprieta el botón mientras la sync sigue
 * corriendo (#451).
 */
jest.mock('../../src/database/client', () => ({ db: {}, sqlite: undefined }));
jest.mock('../../src/database/liveQuery', () => ({ notifyDataChanged: jest.fn() }));
jest.mock('../../src/utils/syncLogger', () => ({
  syncLog: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));
jest.mock('../../src/services/sync/sessionGuard', () => ({
  ensureServerSession: jest.fn().mockResolvedValue(undefined),
  SessionExpiredError: class extends Error {},
}));
jest.mock('../../src/services/sync/preSteps', () => ({
  runGlobalPreSteps: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../src/services/sync/pullService', () => ({ pullFromServer: jest.fn() }));
jest.mock('../../src/services/sync/pushService', () => ({
  uploadSyncableGroups: jest.fn().mockResolvedValue([]),
  uploadSyncableParcelas: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../src/services/sync/photoService', () => ({
  uploadPendingPhotos: jest.fn().mockResolvedValue({ uploaded: 0, failed: 0 }),
  downloadPhotosForPlantation: jest.fn().mockResolvedValue({ downloaded: 0, failed: 0 }),
}));

import { syncPlantation } from '../../src/services/sync/orchestrators';
import { pullFromServer } from '../../src/services/sync/pullService';
import { uploadSyncableGroups, uploadSyncableParcelas } from '../../src/services/sync/pushService';
import { SyncCanceladoError } from '../../src/services/sync/cancelacion';

describe('syncPlantation — una cancelación corta la corrida', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cancelar durante el pull no deja que siga al push', async () => {
    (pullFromServer as jest.Mock).mockRejectedValue(new SyncCanceladoError());

    await expect(syncPlantation('plant-1')).rejects.toBeInstanceOf(SyncCanceladoError);
    expect(uploadSyncableParcelas).not.toHaveBeenCalled();
    expect(uploadSyncableGroups).not.toHaveBeenCalled();
  });

  // El contraste: un pull que falla de verdad SÍ tiene que dejar seguir al push,
  // que es lo que sube lo que el técnico cargó en el campo.
  it('un pull que falla por red sigue al push, como siempre', async () => {
    (pullFromServer as jest.Mock).mockRejectedValue(new Error('Network request failed'));

    await expect(syncPlantation('plant-1')).resolves.toEqual([]);
    expect(uploadSyncableGroups).toHaveBeenCalled();
  });

  it('cancelar durante el push de parcelas no deja que siga con los grupos', async () => {
    (pullFromServer as jest.Mock).mockResolvedValue({ estado: 'ok' });
    (uploadSyncableParcelas as jest.Mock).mockRejectedValue(new SyncCanceladoError());

    await expect(syncPlantation('plant-1')).rejects.toBeInstanceOf(SyncCanceladoError);
    expect(uploadSyncableGroups).not.toHaveBeenCalled();
  });

  it('una parcela que falla por red no frena los grupos', async () => {
    (pullFromServer as jest.Mock).mockResolvedValue({ estado: 'ok' });
    (uploadSyncableParcelas as jest.Mock).mockRejectedValue(new Error('Network request failed'));

    await syncPlantation('plant-1');

    expect(uploadSyncableGroups).toHaveBeenCalled();
  });
});
