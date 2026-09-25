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
    rpc: jest.fn(),
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
let rpcArgs: any;

/** Fila completa como la devuelve drizzle: la edición online compara contra ella. */
const FILA_LOCAL = {
  lugar: 'Viejo', periodo: '2025', descripcion: null, fechaInicio: null, objetivoArboles: null,
  gpsCaptureFrequency: 10, gpsCaptureRequired: true, photoCaptureAllTrees: false, visibleInApp: true,
};

function mockDbChains(parcial: any) {
  const row = parcial && { ...FILA_LOCAL, ...parcial };
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

/** La edición online va por `editar_plantacion` (#634). */
function mockRpcEdicion(data: unknown = { success: true }) {
  rpcArgs = undefined;
  (supabase.rpc as jest.Mock).mockImplementation(async (_nombre: string, args: any) => {
    rpcArgs = args;
    return { data, error: null };
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
    mockRpcEdicion();
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });

    await updatePlantation('plant-1', 'Campo', '2026', GPS);

    expect(supabase.rpc).toHaveBeenCalledWith('editar_plantacion', expect.anything());
    expect(rpcArgs.p_cambios).toMatchObject({
      lugar: 'Campo',
      gps_capture_frequency: 5,
      gps_capture_required: false,
    });
    expect(rpcArgs.p_base).toMatchObject({ lugar: 'Viejo', gps_capture_frequency: 10, gps_capture_required: true });
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
      lugar: 'Viejo',
      periodo: '2025',
    });
    mockNetInfoFetch.mockResolvedValue({ isConnected: false });

    await updatePlantation('plant-1', 'Campo', '2026', GPS);

    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(updatedSet).toMatchObject({
      gpsCaptureFrequency: 5,
      gpsCaptureRequired: false,
      pendingEdit: true,
      baseDeEdicion: expect.objectContaining({ lugar: 'Viejo', gpsCaptureFrequency: 10 }),
    });
  });

  it('updatePlantation offline (primera edición) snapshotea la config GPS de server', async () => {
    mockDbChains({
      pendingSync: false,
      pendingEdit: false,
      lugarServer: null,
      periodoServer: null,
      lugar: 'Viejo',
      periodo: '2025',
      gpsCaptureFrequencyServer: null,
      gpsCaptureRequiredServer: null,
      gpsCaptureFrequency: 10,
      gpsCaptureRequired: true,
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
      gpsCaptureFrequencyServer: 10,
      gpsCaptureRequiredServer: true,
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
    mockRpcEdicion();
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });

    await updatePlantation('plant-1', 'Campo', '2026');

    expect(rpcArgs.p_cambios).not.toHaveProperty('gps_capture_frequency');
    expect(updatedSet).not.toHaveProperty('gpsCaptureFrequency');
  });

  // ─── camino offline-created / fallback de red (issue #301) ─────────────────

  it('updatePlantation en plantación creada offline (pendingSync=true) solo edita local, sin red ni pendingEdit', async () => {
    mockDbChains({ pendingSync: true, pendingEdit: false });

    await updatePlantation('plant-1', 'Campo', '2026', GPS);

    expect(mockNetInfoFetch).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(updatedSet).toMatchObject({ lugar: 'Campo', periodo: '2026', gpsCaptureFrequency: 5 });
    expect(updatedSet).not.toHaveProperty('pendingEdit');
  });

  it('updatePlantation online con falla de RED en el push cae al camino offline y snapshotea server', async () => {
    mockDbChains({
      pendingSync: false,
      pendingEdit: false,
      lugarServer: null,
      periodoServer: null,
      lugar: 'Viejo',
      periodo: '2025',
      gpsCaptureFrequencyServer: null,
      gpsCaptureRequiredServer: null,
      gpsCaptureFrequency: 10,
      gpsCaptureRequired: true,
    });
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    (supabase.rpc as jest.Mock).mockRejectedValue(new Error('Network request failed'));

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
    (supabase.rpc as jest.Mock).mockRejectedValue(new Error('permission denied for table plantations'));

    await expect(updatePlantation('plant-1', 'Campo', '2026', GPS)).rejects.toThrow('permission denied');

    // No hubo fallback: el único intento de escritura local fue el select previo, no un update.
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('updatePlantation online rechazada por archivada falla con el motivo y no escribe local', async () => {
    mockDbChains({ pendingSync: false, pendingEdit: false });
    mockRpcEdicion({ success: false, error: 'PLANTACION_ARCHIVADA' });
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });

    await expect(updatePlantation('plant-1', 'Campo', '2026')).rejects.toThrow('archivada');
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('updatePlantation online sin permiso falla y no escribe local', async () => {
    mockDbChains({ pendingSync: false, pendingEdit: false });
    mockRpcEdicion({ success: false, error: 'NOT_AUTHORIZED' });
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });

    await expect(updatePlantation('plant-1', 'Campo', '2026')).rejects.toThrow('permisos');
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('updatePlantation online con conflicto deja el valor de la web y guarda el conflicto', async () => {
    mockDbChains({ pendingSync: false, pendingEdit: false, objetivoArboles: 12000 });
    mockRpcEdicion({
      success: false,
      error: 'CONFLICTO_EDICION',
      aplicados: ['lugar'],
      conflictos: [{ campo: 'objetivo_arboles', valor_servidor: 12500, editado_por: 'Ana', editado_en: '2026-09-24T13:12:00Z' }],
    });
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });

    const enConflicto = await updatePlantation('plant-1', 'Campo', '2025', { objetivoArboles: 15000 });

    expect(enConflicto).toBe(1);
    expect(rpcArgs.p_base).toEqual({ lugar: 'Viejo', objetivo_arboles: 12000 });
    expect(updatedSet).toMatchObject({
      lugar: 'Campo', lugarServer: 'Campo', objetivoArboles: 12500, objetivoArbolesServer: 12500, pendingEdit: false,
      conflictosDeEdicion: [expect.objectContaining({
        campo: 'objetivoArboles', mio: 15000, web: 12500, anterior: 12000, editadoPor: 'Ana',
      })],
    });
  });

  // ─── datos de #633 ───────────────────────────────────────────────────────────

  const DATOS = {
    descripcion: 'Ribera', fechaInicio: '2026-04-15', objetivoArboles: 12000,
    photoCaptureAllTrees: true, visibleInApp: false,
  };

  it('updatePlantation online sube descripción, fecha, objetivo, foto y visibilidad y deja el snapshot', async () => {
    mockDbChains({ pendingSync: false, pendingEdit: false });
    mockRpcEdicion();
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });

    await updatePlantation('plant-1', 'Campo', '2026', DATOS);

    expect(rpcArgs.p_cambios).toEqual({
      lugar: 'Campo', periodo: '2026', descripcion: 'Ribera', fecha_inicio: '2026-04-15',
      objetivo_arboles: 12000, photo_capture_all_trees: true, visible_in_app: false,
    });
    expect(updatedSet).toMatchObject({ ...DATOS, objetivoArbolesServer: 12000, visibleInAppServer: false, pendingEdit: false });
  });

  it('updatePlantation offline (primera edición) snapshotea los datos previos', async () => {
    mockDbChains({
      pendingSync: false, pendingEdit: false, lugar: 'Viejo', periodo: '2025',
      descripcion: null, objetivoArboles: 8000, visibleInApp: true, visibleInAppServer: null,
    });
    mockNetInfoFetch.mockResolvedValue({ isConnected: false });

    await updatePlantation('plant-1', 'Campo', '2026', DATOS);

    expect(updatedSet).toMatchObject({
      ...DATOS, pendingEdit: true, descripcionServer: null, objetivoArbolesServer: 8000, visibleInAppServer: true,
    });
  });
});
