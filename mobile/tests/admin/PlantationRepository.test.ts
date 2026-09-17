// Tests for PlantationRepository — admin mutation functions
// (La generación de IDs se movió a la web server-side — issue #232.)

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
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

jest.mock('../../src/queries/catalogQueries', () => ({
  getResumenDePendientes: jest.fn(),
}));

import {
  createPlantation,
  finalizePlantation,
  FinalizePlantationLocalSyncError,
  FinalizePlantationPendientesError,
  saveSpeciesConfig,
  assignTechnicians,
} from '../../src/repositories/PlantationRepository';

import { supabase } from '../../src/supabase/client';
import { db } from '../../src/database/client';
import { notifyDataChanged } from '../../src/database/liveQuery';
import { pullFromServer } from '../../src/services/SyncService';
import { syncLog } from '../../src/utils/syncLogger';
import { getResumenDePendientes } from '../../src/queries/catalogQueries';

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
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: null });

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
    const SIN_PENDIENTES = { activaCount: 0, finalizadaCount: 0, parcelas: 0, fotos: 0, borrados: 0 };

    beforeEach(() => {
      (getResumenDePendientes as jest.Mock).mockResolvedValue(SIN_PENDIENTES);
    });

    it('con fotos sin subir: rechaza sin tocar server ni SQLite, porque ya no se podrían subir (#537)', async () => {
      const pendientes = { ...SIN_PENDIENTES, fotos: 1 };
      (getResumenDePendientes as jest.Mock).mockResolvedValue(pendientes);

      const error = await finalizePlantation('plantation-1').catch((e) => e);

      expect(error).toBeInstanceOf(FinalizePlantationPendientesError);
      expect(error.pendientes).toEqual(pendientes);
      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });
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

  // ─── Reemplazo por RPC transaccional (#544) ───────────────────────────────

  const RPC_NO_ENCONTRADO = { code: 'PGRST202', message: 'Could not find the function' };

  /** Respuesta de los RPC de reemplazo y, en el camino sin RPC, de `motivo_no_escribible`. */
  function mockRpc(reemplazo: { data?: unknown; error?: unknown }, motivos: (string | null)[] = []) {
    const pendientes = [...motivos];
    (mockSupabase.rpc as jest.Mock).mockImplementation((nombre: string) => {
      if (nombre === 'motivo_no_escribible') return Promise.resolve({ data: pendientes.shift() ?? null, error: null });
      return Promise.resolve({ data: reemplazo.data ?? null, error: reemplazo.error ?? null });
    });
  }

  const OK = { data: { success: true } };
  const rechazo = (error: string) => ({ data: { success: false, error } });

  describe('saveSpeciesConfig', () => {
    it('reemplaza las especies con un solo RPC y sincroniza', async () => {
      mockRpc(OK);

      await saveSpeciesConfig('plantation-1', [
        { especieId: 'species-1', ordenVisual: 0 },
        { especieId: 'species-2', ordenVisual: 1 },
      ]);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('reemplazar_especies_plantacion', {
        p_plantacion: 'plantation-1',
        p_especies: [
          { species_id: 'species-1', orden_visual: 0 },
          { species_id: 'species-2', orden_visual: 1 },
        ],
      });
      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockPullFromServer).toHaveBeenCalledWith('plantation-1');
      expect(mockNotifyDataChanged).toHaveBeenCalled();
    });

    it('una especie que ya no existe → mensaje claro y no sincroniza', async () => {
      mockRpc(rechazo('ESPECIE_INEXISTENTE'));

      await expect(saveSpeciesConfig('plantation-1', [{ especieId: 'species-1', ordenVisual: 0 }]))
        .rejects.toThrow('Alguna de las especies elegidas ya no existe en el servidor. Los cambios no se guardaron.');
      expect(mockPullFromServer).not.toHaveBeenCalled();
    });
  });

  describe('assignTechnicians', () => {
    it('reemplaza los técnicos con un solo RPC y sincroniza', async () => {
      mockRpc(OK);

      await assignTechnicians('plantation-1', ['user-1', 'user-2']);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('reemplazar_tecnicos_plantacion', {
        p_plantacion: 'plantation-1',
        p_user_ids: ['user-1', 'user-2'],
      });
      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockPullFromServer).toHaveBeenCalledWith('plantation-1');
      expect(mockNotifyDataChanged).toHaveBeenCalled();
    });

    it('un usuario de otra organización → mensaje claro', async () => {
      mockRpc(rechazo('USUARIO_DE_OTRA_ORGANIZACION'));

      await expect(assignTechnicians('plantation-1', ['user-1']))
        .rejects.toThrow('Alguno de los técnicos elegidos no pertenece a tu organización. Los cambios no se guardaron.');
    });
  });

  describe('rechazos y errores del RPC', () => {
    it.each([
      ['PLANTACION_INEXISTENTE', 'La plantación ya no existe en el servidor. Los cambios no se guardaron.'],
      ['PLANTACION_ARCHIVADA', 'La plantación está archivada y no acepta cambios. Los cambios no se guardaron.'],
      ['PLANTACION_FINALIZADA', 'La plantación está finalizada: solo un superadmin puede cambiar su configuración. Los cambios no se guardaron.'],
      ['NOT_AUTHORIZED', 'No tenés permiso para cambiar esta plantación. Los cambios no se guardaron.'],
      ['OTRO_CODIGO', 'El servidor rechazó el cambio. Los cambios no se guardaron.'],
    ])('%s → mensaje claro, sin escritura directa ni pull', async (codigo, mensaje) => {
      mockRpc(rechazo(codigo));

      await expect(saveSpeciesConfig('plantation-1', [])).rejects.toThrow(mensaje);
      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockPullFromServer).not.toHaveBeenCalled();
    });

    it('un error de red se propaga tal cual y no cae al camino sin RPC', async () => {
      const error = { code: '', message: 'TypeError: Network request failed' };
      mockRpc({ error });

      await expect(assignTechnicians('plantation-1', ['user-1'])).rejects.toBe(error);
      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockPullFromServer).not.toHaveBeenCalled();
    });
  });

  // ─── Server sin el RPC: camino anterior con chequeo previo (#522) ─────────

  describe('server sin el RPC de reemplazo', () => {
    function mockUsersInsert(error: { code: string; message: string } | null) {
      const eqRol = jest.fn().mockResolvedValue({ error: null, count: 0 });
      const eqPlantation = jest.fn().mockReturnValue({ eq: eqRol });
      const insertMock = jest.fn().mockResolvedValue({ error });
      (mockSupabase.from as jest.Mock).mockReturnValue({
        delete: jest.fn().mockReturnValue({ eq: eqPlantation }),
        insert: insertMock,
      });
      return { insertMock, eqPlantation, eqRol };
    }

    it('saveSpeciesConfig: borra e inserta en plantation_species', async () => {
      mockRpc({ error: RPC_NO_ENCONTRADO });

      await saveSpeciesConfig('plantation-1', [{ especieId: 'species-1', ordenVisual: 0 }]);

      expect(mockSupabase.from).toHaveBeenCalledWith('plantation_species');
      expect(mockPullFromServer).toHaveBeenCalledWith('plantation-1');
    });

    it('assignTechnicians: borra solo filas tecnico e inserta las nuevas', async () => {
      mockRpc({ error: RPC_NO_ENCONTRADO });
      const { insertMock, eqPlantation, eqRol } = mockUsersInsert(null);

      await assignTechnicians('plantation-1', ['user-1', 'user-2']);

      expect(eqPlantation).toHaveBeenCalledWith('plantation_id', 'plantation-1');
      expect(eqRol).toHaveBeenCalledWith('rol_en_plantacion', 'tecnico');
      const insertedRows = insertMock.mock.calls[0][0];
      expect(insertedRows).toHaveLength(2);
      expect(insertedRows.every((r: any) => r.rol_en_plantacion === 'tecnico')).toBe(true);
      expect(mockPullFromServer).toHaveBeenCalledWith('plantation-1');
    });

    it('saveSpeciesConfig: eliminada antes de guardar → mensaje claro y no escribe', async () => {
      mockRpc({ error: RPC_NO_ENCONTRADO }, ['PLANTACION_INEXISTENTE']);

      await expect(saveSpeciesConfig('plantation-1', [{ especieId: 'species-1', ordenVisual: 0 }]))
        .rejects.toThrow('La plantación ya no existe en el servidor. Los cambios no se guardaron.');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('motivo_no_escribible', { p_plantation_id: 'plantation-1' });
      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockPullFromServer).not.toHaveBeenCalled();
    });

    it('assignTechnicians: una finalizada admite asignaciones', async () => {
      mockRpc({ error: RPC_NO_ENCONTRADO }, ['PLANTACION_FINALIZADA']);
      mockUsersInsert(null);

      await assignTechnicians('plantation-1', ['user-1']);

      expect(mockPullFromServer).toHaveBeenCalledWith('plantation-1');
    });

    it('assignTechnicians: eliminada entre el chequeo y la escritura → traduce el FK a mensaje claro', async () => {
      mockRpc({ error: RPC_NO_ENCONTRADO }, [null, 'PLANTACION_INEXISTENTE']);
      mockUsersInsert({ code: '23503', message: 'insert or update violates foreign key constraint' });

      await expect(assignTechnicians('plantation-1', ['user-1']))
        .rejects.toThrow('La plantación ya no existe en el servidor. Los cambios no se guardaron.');
      expect(mockPullFromServer).not.toHaveBeenCalled();
    });

    it('un error que no es de la plantación se propaga tal cual', async () => {
      mockRpc({ error: RPC_NO_ENCONTRADO }, [null, null]);
      const error = { code: '08006', message: 'connection failure' };
      mockUsersInsert(error);

      await expect(assignTechnicians('plantation-1', ['user-1'])).rejects.toBe(error);
    });
  });
});
