// Tests for PlantationRepository — admin mutation functions
// (La generación de IDs se movió a la web server-side — issue #232.)

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
    transaction: jest.fn(),
  },
}));

jest.mock('../../src/database/liveQuery', () => ({
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/services/SyncService', () => ({
  pullFromServer: jest.fn(),
}));

jest.mock('../../src/utils/syncLogger', () => ({
  syncLog: { info: jest.fn(), error: jest.fn() },
}));

import {
  createPlantation,
  finalizePlantation,
  FinalizePlantationLocalSyncError,
  saveSpeciesConfig,
  assignTechnicians,
} from '../../src/repositories/PlantationRepository';

import { supabase } from '../../src/supabase/client';
import { db } from '../../src/database/client';
import { notifyDataChanged } from '../../src/database/liveQuery';
import { pullFromServer } from '../../src/services/SyncService';
import { syncLog } from '../../src/utils/syncLogger';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockDb = db as jest.Mocked<typeof db>;
const mockNotifyDataChanged = notifyDataChanged as jest.Mock;
const mockPullFromServer = pullFromServer as jest.Mock;
const mockSyncLog = syncLog as jest.Mocked<typeof syncLog>;

const fakePlantation = {
  id: 'plantation-uuid-1',
  organizacion_id: 'org-1',
  lugar: 'Zona Norte',
  periodo: '2026',
  estado: 'activa',
  creado_por: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
};

describe('PlantationRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockPullFromServer.mockResolvedValue(undefined);

    (mockSupabase.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: fakePlantation, error: null }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
      delete: jest.fn().mockReturnValue({
        // assignTechnicians encadena .eq(plantation_id).eq(rol_en_plantacion)
        eq: jest.fn().mockReturnValue(
          Object.assign(Promise.resolve({ error: null }), {
            eq: jest.fn().mockResolvedValue({ error: null }),
          })
        ),
      }),
    });

    // Upsert de plantación + membresía local (#67).
    (mockDb.insert as jest.Mock).mockReturnValue({
      values: jest.fn().mockReturnValue({
        onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
        onConflictDoNothing: jest.fn().mockResolvedValue(undefined),
      }),
    });

    (mockDb.update as jest.Mock).mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    });

    (mockDb.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue([]),
        }),
      }),
    });
  });

  // ─── createPlantation ─────────────────────────────────────────────────────

  describe('createPlantation', () => {
    it('Test 1: calls supabase.from("plantations").insert() and upserts into local SQLite', async () => {
      await createPlantation('Zona Norte', '2026', 'org-1', 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('plantations');

      const fromResult = (mockSupabase.from as jest.Mock).mock.results[0].value;
      expect(fromResult.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          lugar: 'Zona Norte',
          periodo: '2026',
          organizacion_id: 'org-1',
          creado_por: 'user-1',
          estado: 'activa',
        })
      );

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('Test 2: calls notifyDataChanged after local upsert', async () => {
      await createPlantation('Zona Norte', '2026', 'org-1', 'user-1');

      expect(mockNotifyDataChanged).toHaveBeenCalledTimes(1);
    });

    it('Test 2b: registra al creador como miembro admin local (issue #67)', async () => {
      await createPlantation('Zona Norte', '2026', 'org-1', 'user-1');

      const valuesMock = (mockDb.insert as jest.Mock).mock.results[0].value.values as jest.Mock;
      const membership = valuesMock.mock.calls.map((c) => c[0]).find((v: any) => v?.rolEnPlantacion);
      expect(membership).toMatchObject({
        plantationId: 'plantation-uuid-1',
        userId: 'user-1',
        rolEnPlantacion: 'admin',
      });
    });
  });

  // ─── finalizePlantation ───────────────────────────────────────────────────

  describe('finalizePlantation', () => {
    it('Test 3: updates estado to "finalizada" on BOTH supabase and local SQLite', async () => {
      await finalizePlantation('plantation-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('plantations');
      const fromResult = (mockSupabase.from as jest.Mock).mock.results[0].value;
      expect(fromResult.update).toHaveBeenCalledWith({ estado: 'finalizada' });

      expect(mockDb.update).toHaveBeenCalled();
      const updateResult = (mockDb.update as jest.Mock).mock.results[0].value;
      expect(updateResult.set).toHaveBeenCalledWith({ estado: 'finalizada' });
    });

    it('Test 4: calls notifyDataChanged after updates', async () => {
      await finalizePlantation('plantation-1');

      expect(mockNotifyDataChanged).toHaveBeenCalledTimes(1);
    });

    it('Test 5: server ok + local fails — throws FinalizePlantationLocalSyncError, logs, does NOT notify', async () => {
      (mockDb.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockRejectedValue(new Error('SQLITE_BUSY')),
        }),
      });

      await expect(finalizePlantation('plantation-1')).rejects.toThrow(FinalizePlantationLocalSyncError);

      // El server ya quedó finalizado: no debe repetirse el update remoto ni notificar UI a medias.
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
      expect(mockNotifyDataChanged).not.toHaveBeenCalled();
      expect(mockSyncLog.error).toHaveBeenCalledWith(expect.stringContaining('plantation-1'), expect.any(Error));
    });

    it('Test 6: server fails — local SQLite untouched, error del server se propaga', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: new Error('permission denied') }),
        }),
      });

      await expect(finalizePlantation('plantation-1')).rejects.toThrow('permission denied');

      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockNotifyDataChanged).not.toHaveBeenCalled();
    });
  });

  // ─── saveSpeciesConfig ────────────────────────────────────────────────────

  describe('saveSpeciesConfig', () => {
    it('Test 5: deletes all existing species, inserts new ones, calls pullFromServer', async () => {
      const items = [
        { especieId: 'species-1', ordenVisual: 0 },
        { especieId: 'species-2', ordenVisual: 1 },
      ];

      await saveSpeciesConfig('plantation-1', items);

      expect(mockSupabase.from).toHaveBeenCalledWith('plantation_species');
      const fromCalls = (mockSupabase.from as jest.Mock).mock.calls;
      const psCall = fromCalls.find((args) => args[0] === 'plantation_species');
      expect(psCall).toBeTruthy();

      expect(mockPullFromServer).toHaveBeenCalledWith('plantation-1');
      expect(mockNotifyDataChanged).toHaveBeenCalled();
    });
  });

  // ─── assignTechnicians ────────────────────────────────────────────────────

  describe('assignTechnicians', () => {
    it('Test 6: borra solo filas tecnico, inserta las nuevas y llama pullFromServer', async () => {
      const eqRol = jest.fn().mockResolvedValue({ error: null, count: 2 });
      const eqPlantation = jest.fn().mockReturnValue({ eq: eqRol });
      const deleteMock = jest.fn().mockReturnValue({ eq: eqPlantation });
      const insertMock = jest.fn().mockResolvedValue({ error: null });
      (mockSupabase.from as jest.Mock).mockReturnValue({
        delete: deleteMock,
        insert: insertMock,
      });

      await assignTechnicians('plantation-1', ['user-1', 'user-2']);

      expect(mockSupabase.from).toHaveBeenCalledWith('plantation_users');
      // Issue #67: el delete DEBE filtrar por rol para preservar membresías admin.
      expect(eqPlantation).toHaveBeenCalledWith('plantation_id', 'plantation-1');
      expect(eqRol).toHaveBeenCalledWith('rol_en_plantacion', 'tecnico');
      const insertedRows = insertMock.mock.calls[0][0];
      expect(insertedRows).toHaveLength(2);
      expect(insertedRows.every((r: any) => r.rol_en_plantacion === 'tecnico')).toBe(true);

      expect(mockPullFromServer).toHaveBeenCalledWith('plantation-1');
      expect(mockNotifyDataChanged).toHaveBeenCalled();
    });
  });
});
