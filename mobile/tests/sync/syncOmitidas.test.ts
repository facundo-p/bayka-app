// Sync con plantaciones sin acceso o eliminadas en el servidor (#478): se saltean
// enteras —push y fotos— y el resultado dice cuáles fueron.

jest.mock('../../src/database/client', () => ({ db: { select: jest.fn() } }));
jest.mock('../../src/database/liveQuery', () => ({ notifyDataChanged: jest.fn() }));
jest.mock('../../src/services/sync/sessionGuard', () => ({ ensureServerSession: jest.fn() }));
jest.mock('../../src/services/sync/preSteps', () => ({ runGlobalPreSteps: jest.fn() }));
jest.mock('../../src/services/sync/pullService', () => ({ pullFromServer: jest.fn() }));
jest.mock('../../src/services/sync/pushService', () => ({
  pushBorrados: jest.fn(),
  uploadSyncableParcelas: jest.fn(),
  uploadSyncableGroups: jest.fn(),
}));
jest.mock('../../src/services/sync/photoService', () => ({
  uploadPendingPhotos: jest.fn(),
  downloadPhotosForPlantation: jest.fn(),
}));

import { syncAllPlantations, syncPlantation } from '../../src/services/sync/orchestrators';
import { plantacionesOmitidas } from '../../src/services/sync/plantacionesOmitidas';
import { db } from '../../src/database/client';
import { runGlobalPreSteps } from '../../src/services/sync/preSteps';
import { pullFromServer } from '../../src/services/sync/pullService';
import { pushBorrados, uploadSyncableParcelas, uploadSyncableGroups } from '../../src/services/sync/pushService';
import { uploadPendingPhotos, downloadPhotosForPlantation } from '../../src/services/sync/photoService';

const PLANTACIONES = [
  { id: 'p-ok', lugar: 'Norte' },
  { id: 'p-eliminada', lugar: 'Sur' },
  { id: 'p-sin-acceso', lugar: 'Este' },
];

const PULL_POR_ID: Record<string, { estado: string }> = {
  'p-ok': { estado: 'ok' },
  'p-eliminada': { estado: 'eliminada' },
  'p-sin-acceso': { estado: 'sin-acceso' },
};

beforeEach(() => {
  jest.clearAllMocks();
  (db.select as jest.Mock).mockReturnValue({ from: jest.fn().mockResolvedValue(PLANTACIONES) });
  (runGlobalPreSteps as jest.Mock).mockResolvedValue([]);
  (pullFromServer as jest.Mock).mockImplementation(async (id: string) => PULL_POR_ID[id]);
  (uploadSyncableParcelas as jest.Mock).mockResolvedValue([]);
  (uploadSyncableGroups as jest.Mock).mockResolvedValue([]);
  (uploadPendingPhotos as jest.Mock).mockResolvedValue({ uploaded: 0, failed: 0 });
  (downloadPhotosForPlantation as jest.Mock).mockResolvedValue({ downloaded: 0, failed: 0 });
});

const idsLlamados = (fn: unknown) => (fn as jest.Mock).mock.calls.map((c) => c[0]);

describe('syncAllPlantations', () => {
  it('informa qué plantaciones quedaron sin acceso y cuáles eliminadas', async () => {
    const resultados = await syncAllPlantations(undefined, false);

    expect(resultados.map((r) => r.pull)).toEqual([
      { estado: 'ok' },
      { estado: 'eliminada' },
      { estado: 'sin-acceso' },
    ]);
    expect(plantacionesOmitidas(resultados)).toEqual({ sinAcceso: ['Este'], eliminadas: ['Sur'] });
  });

  it('no pushea borrados, parcelas ni grupos de las omitidas', async () => {
    await syncAllPlantations(undefined, false);

    expect(idsLlamados(pushBorrados)).toEqual(['p-ok']);
    expect(idsLlamados(uploadSyncableParcelas)).toEqual(['p-ok']);
    expect(idsLlamados(uploadSyncableGroups)).toEqual(['p-ok']);
  });

  it('saltea la subida y bajada de fotos de las omitidas', async () => {
    await syncAllPlantations(undefined, true);

    expect(idsLlamados(uploadPendingPhotos)).toEqual(['p-ok']);
    expect(idsLlamados(downloadPhotosForPlantation)).toEqual(['p-ok']);
  });

  it('una plantación cuyo pull tiró sigue intentando sus fotos, como antes', async () => {
    (pullFromServer as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'p-ok') throw new Error('Network request failed');
      return PULL_POR_ID[id];
    });

    const resultados = await syncAllPlantations(undefined, true);

    expect(resultados[0].fallo).toBeInstanceOf(Error);
    expect(idsLlamados(uploadPendingPhotos)).toEqual(['p-ok']);
  });
});

describe('syncPlantation', () => {
  it('eliminada: reporta el pull y no pushea nada', async () => {
    const onPullResult = jest.fn();

    const resultados = await syncPlantation('p-eliminada', { onPullResult });

    expect(resultados).toEqual([]);
    expect(onPullResult).toHaveBeenCalledWith({ estado: 'eliminada' });
    expect(pushBorrados).not.toHaveBeenCalled();
    expect(uploadSyncableParcelas).not.toHaveBeenCalled();
    expect(uploadSyncableGroups).not.toHaveBeenCalled();
  });
});
