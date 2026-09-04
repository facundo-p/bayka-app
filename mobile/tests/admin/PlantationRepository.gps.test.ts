// Tests de la config GPS por plantación (issue #100): creación y edición
// con la lógica dual online/offline de updatePlantation.

const mockNetInfoFetch = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  fetch: (...args: any[]) => mockNetInfoFetch(...args),
}));

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getSession: jest.fn() },
  },
  isSupabaseConfigured: true,
}));

jest.mock('../../src/database/client', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../src/database/liveQuery', () => ({
  notifyDataChanged: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-123'),
}));

import {
  createPlantationLocally,
  discardPlantationEdit,
  updatePlantation,
} from '../../src/repositories/PlantationRepository';
import { db } from '../../src/database/client';
import { supabase } from '../../src/supabase/client';

const mockDb = db as jest.Mocked<typeof db>;
const GPS = { gpsCaptureFrequency: 5, gpsCaptureRequired: false };

let insertedValues: any;
let updatedSet: any;
let supabaseUpdatePayload: any;

function mockDbChains(row: any) {
  insertedValues = undefined;
  updatedSet = undefined;
  (mockDb.insert as jest.Mock).mockReturnValue({
    // Ignora el insert de membresía local (tiene rolEnPlantacion) para que
    // insertedValues siga capturando la fila de la plantación (#67).
    values: jest.fn().mockImplementation((v: any) => {
      if (!v?.rolEnPlantacion) insertedValues = v;
      return Object.assign(Promise.resolve(), {
        onConflictDoNothing: jest.fn().mockResolvedValue(undefined),
      });
    }),
  });
  (mockDb.update as jest.Mock).mockReturnValue({
    set: jest.fn().mockImplementation((s: any) => {
      updatedSet = s;
      return { where: jest.fn().mockResolvedValue(undefined) };
    }),
  });
  (mockDb.select as jest.Mock).mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([row]),
    }),
  });
}

function mockSupabaseUpdate(error: any = null) {
  supabaseUpdatePayload = undefined;
  (supabase.from as jest.Mock).mockReturnValue({
    update: jest.fn().mockImplementation((payload: any) => {
      supabaseUpdatePayload = payload;
      return { eq: jest.fn().mockResolvedValue({ error }) };
    }),
  });
}

describe('config GPS por plantación', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createPlantationLocally persiste la config GPS elegida', async () => {
    mockDbChains(null);
    await createPlantationLocally('Campo', '2026', 'org-1', 'user-1', GPS);
    expect(insertedValues).toMatchObject({
      gpsCaptureFrequency: 5,
      gpsCaptureRequired: false,
      pendingSync: true,
    });
  });

  it('updatePlantation online sube la config al server y la guarda local', async () => {
    mockDbChains({ pendingSync: false, pendingEdit: false });
    mockSupabaseUpdate();
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });

    await updatePlantation('plant-1', 'Campo', '2026', GPS);

    expect(supabaseUpdatePayload).toMatchObject({
      lugar: 'Campo',
      gps_capture_frequency: 5,
      gps_capture_required: false,
    });
    expect(updatedSet).toMatchObject({
      gpsCaptureFrequency: 5,
      gpsCaptureRequired: false,
      pendingEdit: false,
    });
  });

  it('updatePlantation offline guarda la config local con pendingEdit=true', async () => {
    mockDbChains({
      pendingSync: false,
      pendingEdit: false,
      lugarServer: null,
      periodoServer: null,
      lugarCurrent: 'Viejo',
      periodoCurrent: '2025',
    });
    mockNetInfoFetch.mockResolvedValue({ isConnected: false });

    await updatePlantation('plant-1', 'Campo', '2026', GPS);

    expect(supabase.from).not.toHaveBeenCalled();
    expect(updatedSet).toMatchObject({
      gpsCaptureFrequency: 5,
      gpsCaptureRequired: false,
      pendingEdit: true,
    });
  });

  it('updatePlantation offline (primera edición) snapshotea la config GPS de server', async () => {
    mockDbChains({
      pendingSync: false,
      pendingEdit: false,
      lugarServer: null,
      periodoServer: null,
      lugarCurrent: 'Viejo',
      periodoCurrent: '2025',
      gpsFreqServer: null,
      gpsReqServer: null,
      gpsFreqCurrent: 10,
      gpsReqCurrent: true,
    });
    mockNetInfoFetch.mockResolvedValue({ isConnected: false });

    await updatePlantation('plant-1', 'Campo', '2026', GPS);

    // Snapshotea el valor PRE-edición (10/true) para que discard pueda revertir.
    expect(updatedSet).toMatchObject({
      gpsCaptureFrequency: 5,
      gpsCaptureFrequencyServer: 10,
      gpsCaptureRequiredServer: true,
      pendingEdit: true,
    });
  });

  it('discardPlantationEdit revierte la config GPS al snapshot de server', async () => {
    mockDbChains({
      lugarServer: 'Campo Server',
      periodoServer: '2026',
      gpsFreqServer: 10,
      gpsReqServer: true,
    });

    await discardPlantationEdit('plant-1');

    expect(updatedSet).toMatchObject({
      lugar: 'Campo Server',
      periodo: '2026',
      gpsCaptureFrequency: 10,
      gpsCaptureRequired: true,
      pendingEdit: false,
    });
  });

  it('updatePlantation sin config GPS no toca esos campos (compat llamadas viejas)', async () => {
    mockDbChains({ pendingSync: false, pendingEdit: false });
    mockSupabaseUpdate();
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });

    await updatePlantation('plant-1', 'Campo', '2026');

    expect(supabaseUpdatePayload).not.toHaveProperty('gps_capture_frequency');
    expect(updatedSet).not.toHaveProperty('gpsCaptureFrequency');
  });

  // ─── camino offline-created / fallback de red (issue #301) ─────────────────

  it('updatePlantation en plantación creada offline (pendingSync=true) solo edita local, sin red ni pendingEdit', async () => {
    mockDbChains({ pendingSync: true, pendingEdit: false });

    await updatePlantation('plant-1', 'Campo', '2026', GPS);

    expect(mockNetInfoFetch).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(updatedSet).toMatchObject({ lugar: 'Campo', periodo: '2026', gpsCaptureFrequency: 5 });
    expect(updatedSet).not.toHaveProperty('pendingEdit');
  });

  it('updatePlantation online con falla de RED en el push cae al camino offline y snapshotea server', async () => {
    mockDbChains({
      pendingSync: false,
      pendingEdit: false,
      lugarServer: null,
      periodoServer: null,
      lugarCurrent: 'Viejo',
      periodoCurrent: '2025',
      gpsFreqServer: null,
      gpsReqServer: null,
      gpsFreqCurrent: 10,
      gpsReqCurrent: true,
    });
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    (supabase.from as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockRejectedValue(new Error('Network request failed')),
      }),
    });

    await updatePlantation('plant-1', 'Campo', '2026', GPS);

    // Cayó al camino offline: snapshotea el valor PRE-edición y marca pendingEdit.
    expect(updatedSet).toMatchObject({
      lugar: 'Campo',
      lugarServer: 'Viejo',
      periodoServer: '2025',
      gpsCaptureFrequencyServer: 10,
      gpsCaptureRequiredServer: true,
      pendingEdit: true,
    });
  });

  it('updatePlantation online con error NO relacionado a red se propaga (no cae al camino offline)', async () => {
    mockDbChains({ pendingSync: false, pendingEdit: false });
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    (supabase.from as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockRejectedValue(new Error('permission denied for table plantations')),
      }),
    });

    await expect(updatePlantation('plant-1', 'Campo', '2026', GPS)).rejects.toThrow('permission denied');

    // No hubo fallback: el único intento de escritura local fue el select previo, no un update.
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});
