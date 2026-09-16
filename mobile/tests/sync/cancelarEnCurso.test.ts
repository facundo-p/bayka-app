/**
 * El sync está lleno de `catch` de "seguir ante fallas": una parcela que falla no
 * frena a las demás, un pull que falla no frena al push. Sin re-lanzar, esos catch
 * se tragan la cancelación y el usuario aprieta el botón mientras la sync sigue
 * corriendo (#451).
 */
jest.mock('../../src/database/client', () => ({ db: { select: jest.fn() }, sqlite: undefined }));
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

import { syncAllPlantations, syncPlantation } from '../../src/services/sync/orchestrators';
import { db } from '../../src/database/client';
import { MARCA_DE_TIMEOUT } from '../../src/supabase/fetchConTimeout';
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

/**
 * El push sigue aunque el pull falle —subir lo que el técnico cargó vale más que
 * el pull— pero el usuario tiene que enterarse. Sin avisar, la UI le dice "Datos
 * actualizados" a un pull que no bajó nada (#451).
 */
describe('syncPlantation — un pull que falla se avisa', () => {
  beforeEach(() => jest.clearAllMocks());

  it('avisa del pull fallido y sigue con el push', async () => {
    const caida = new Error('Network request failed');
    (pullFromServer as jest.Mock).mockRejectedValue(caida);
    const onPullError = jest.fn();

    await syncPlantation('plant-1', { onPullError });

    expect(onPullError).toHaveBeenCalledWith(caida);
    expect(uploadSyncableGroups).toHaveBeenCalled();
  });

  it('un timeout del pull llega como tal, no como un error genérico', async () => {
    const timeout = new Error(`${MARCA_DE_TIMEOUT}: sin respuesta en 30000ms — /rest/v1/trees`);
    (pullFromServer as jest.Mock).mockRejectedValue(timeout);
    const onPullError = jest.fn();

    await syncPlantation('plant-1', { onPullError });

    expect(onPullError).toHaveBeenCalledWith(timeout);
  });

  it('un pull que sale bien no dispara el aviso', async () => {
    (pullFromServer as jest.Mock).mockResolvedValue({ estado: 'ok' });
    const onPullError = jest.fn();

    await syncPlantation('plant-1', { onPullError });

    expect(onPullError).not.toHaveBeenCalled();
  });

  it('una cancelación del pull no se reporta como pull fallido', async () => {
    (pullFromServer as jest.Mock).mockRejectedValue(new SyncCanceladoError());
    const onPullError = jest.fn();

    await expect(syncPlantation('plant-1', { onPullError })).rejects.toBeInstanceOf(SyncCanceladoError);
    expect(onPullError).not.toHaveBeenCalled();
  });
});

describe('syncAllPlantations — una plantación caída queda registrada', () => {
  const unaPlantacionLocal = () => {
    (db.select as jest.Mock).mockReturnValue({ from: jest.fn().mockResolvedValue([{ id: 'p1', lugar: 'Campo Norte' }]) });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    unaPlantacionLocal();
  });

  // Sin el `fallo`, una corrida donde todo se cayó llega a la UI con listas vacías,
  // indistinguible de una donde no había nada que sincronizar (#451).
  it('guarda la excepción que la tumbó, no solo listas vacías', async () => {
    const caida = new Error('Network request failed');
    (pullFromServer as jest.Mock).mockRejectedValue(caida);

    const [resultado] = await syncAllPlantations(undefined, false);

    expect(resultado.fallo).toBe(caida);
    expect(resultado.results).toEqual([]);
  });

  it('una plantación que sincroniza bien no queda marcada', async () => {
    (pullFromServer as jest.Mock).mockResolvedValue({ estado: 'ok' });

    const [resultado] = await syncAllPlantations(undefined, false);

    expect(resultado.fallo).toBeUndefined();
  });

  it('cancelar corta el barrido en vez de marcar la plantación como caída', async () => {
    (pullFromServer as jest.Mock).mockRejectedValue(new SyncCanceladoError());

    await expect(syncAllPlantations(undefined, false)).rejects.toBeInstanceOf(SyncCanceladoError);
  });
});
