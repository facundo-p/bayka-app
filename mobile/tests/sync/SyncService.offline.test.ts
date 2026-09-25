// Tests for offline sync functions in SyncService

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getSession: jest.fn(), getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
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

jest.mock('../../src/repositories/PendientesVaradosRepository', () => ({
  guardarMotivoVarado: jest.fn(),
  limpiarMotivoVarado: jest.fn(),
}));
jest.mock('../../src/database/liveQuery', () => ({
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/repositories/GroupRepository', () => ({
  markAsSincronizada: jest.fn(),
  getSyncableGroups: jest.fn().mockResolvedValue([]),
}));

import {
  pullSpeciesFromServer,
  uploadOfflinePlantations,
  uploadPendingEdits,
} from '../../src/services/SyncService';

import { supabase } from '../../src/supabase/client';
import { db } from '../../src/database/client';
import { PG_ERROR } from '../../src/supabase/postgresErrorCodes';
import { guardarMotivoVarado, limpiarMotivoVarado } from '../../src/repositories/PendientesVaradosRepository';
import { REINTENTA_TODAS, conRegistroDeVarados } from '../../src/services/sync/pendientesVarados';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockDb = db as jest.Mocked<typeof db>;

const fakeSpecies = [
  { id: 'sp-1', codigo: 'QRC', nombre: 'Quercus robur', nombre_cientifico: 'Quercus robur', created_at: '2026-01-01T00:00:00Z' },
  { id: 'sp-2', codigo: 'PIN', nombre: 'Pino', nombre_cientifico: null, created_at: '2026-01-01T00:00:00Z' },
];

const fakePendingPlantation = {
  id: 'plantation-offline-1',
  organizacionId: 'org-1',
  lugar: 'Zona Offline',
  periodo: '2026',
  estado: 'activa',
  creadoPor: 'user-1',
  createdAt: '2026-04-01T00:00:00Z',
  pendingSync: true,
};

const fakePlantationSpecies = [
  { id: 'ps-plantation-offline-1-sp-1', plantacionId: 'plantation-offline-1', especieId: 'sp-1', ordenVisual: 0 },
];

describe('SyncService — offline functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default db.insert chain with onConflictDoUpdate support
    (mockDb.insert as jest.Mock).mockReturnValue({
      values: jest.fn().mockReturnValue({
        onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
      }),
    });

    // Default db.select chain
    (mockDb.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });

    // Default db.update chain
    (mockDb.update as jest.Mock).mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    });

    // Default supabase.from chain
    (mockSupabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
      upsert: jest.fn().mockResolvedValue({ error: null }),
    });
  });

  // ─── pullSpeciesFromServer ─────────────────────────────────────────────────

  describe('pullSpeciesFromServer', () => {
    it('Test 1: calls supabase.from("species").select("*") and upserts the catalog in one batched insert', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: fakeSpecies, error: null }),
      });

      await pullSpeciesFromServer();

      expect(mockSupabase.from).toHaveBeenCalledWith('species');
      const fromResult = (mockSupabase.from as jest.Mock).mock.results[0].value;
      expect(fromResult.select).toHaveBeenCalledWith('*');

      // Un solo statement para el catálogo entero, no uno por especie (#449).
      expect(mockDb.insert).toHaveBeenCalledTimes(1);

      const unicoInsert = (mockDb.insert as jest.Mock).mock.results[0].value;
      expect(unicoInsert.values).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'sp-1', codigo: 'QRC', nombre: 'Quercus robur' }),
        expect.objectContaining({ id: 'sp-2' }),
      ]);
      const valores = unicoInsert.values.mock.results[0].value;
      expect(valores.onConflictDoUpdate).toHaveBeenCalled();
    });

    it('Test 2: does NOT call db.insert if supabase returns an error', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: null, error: { message: 'Network error' } }),
      });

      await pullSpeciesFromServer();

      // No db.insert calls — non-blocking behavior
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('Test 3: does NOT call db.delete — only upserts (preserves existing species)', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: fakeSpecies, error: null }),
      });

      await pullSpeciesFromServer();

      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  // ─── uploadOfflinePlantations ──────────────────────────────────────────────

  describe('uploadOfflinePlantations', () => {
    it('Test 4: happy path — queries pending plantations, inserts to server, sube las especies como altas, marks pendingSync=false', async () => {
      // Return pending plantation from local db
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([fakePendingPlantation]),
        }),
      });

      // Return plantation_species from local db
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(fakePlantationSpecies),
        }),
      });

      // supabase.from('plantations').insert() -> success
      (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'plantations') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          select: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      });
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true, rechazadas: [] }, error: null });

      const happyResults = await uploadOfflinePlantations();
      expect(happyResults).toEqual([
        // El mock no responde el chequeo de duplicado: sin aviso, y la subida no se frena.
        { success: true, plantacionId: fakePendingPlantation.id, nombre: fakePendingPlantation.lugar, duplicada: false, cambiosPorResolver: 0 },
      ]);

      // Verify plantation was inserted to server
      const plantationFromCalls = (mockSupabase.from as jest.Mock).mock.calls;
      expect(plantationFromCalls.some(([t]) => t === 'plantations')).toBe(true);
      // Altas y no upsert de la lista: no pisa lo que la web sumó si un intento anterior ya la subió (#635).
      expect(mockSupabase.rpc).toHaveBeenCalledWith('aplicar_cambios_especies', {
        p_plantacion: fakePendingPlantation.id,
        p_altas: fakePlantationSpecies.map((ps) => ps.especieId),
        p_bajas: [],
      });

      // Verify pendingSync=false was set
      expect(mockDb.update).toHaveBeenCalled();
      const updateResult = (mockDb.update as jest.Mock).mock.results[0].value;
      expect(updateResult.set).toHaveBeenCalledWith({ pendingSync: false });
    });

    it('Test 5: 23505 (duplicate key) — actualiza la fila, sube species y marca pendingSync=false', async () => {
      // Return pending plantation
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([fakePendingPlantation]),
        }),
      });

      // Return plantation_species
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(fakePlantationSpecies),
        }),
      });

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      // supabase.from returns 23505 error for plantation insert
      (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'plantations') {
          return {
            insert: jest.fn().mockResolvedValue({ error: { code: PG_ERROR.UNIQUE_VIOLATION, message: 'duplicate key' } }),
          };
        }
        return { select: jest.fn().mockResolvedValue({ data: [], error: null }) };
      });

      await uploadOfflinePlantations();

      // Ya existía y sin snapshot (alta de una versión anterior): manda todo por la RPC, con su propio valor como base.
      expect(mockSupabase.rpc).toHaveBeenCalledWith('editar_plantacion', expect.objectContaining({
        p_cambios: expect.objectContaining({ lugar: fakePendingPlantation.lugar }),
        p_base: expect.objectContaining({ lugar: fakePendingPlantation.lugar }),
      }));
      expect(mockSupabase.rpc).toHaveBeenCalledWith('aplicar_cambios_especies', expect.anything());

      // pendingSync MUST be set to false
      const sets = (mockDb.update as jest.Mock).mock.results.map((r) => r.value.set.mock.calls).flat();
      expect(sets).toContainEqual([{ pendingSync: false }]);
    });

    it('23505 con snapshot: sube solo lo editado desde el intento anterior, con lo subido como base', async () => {
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{
            ...fakePendingPlantation, lugar: 'Zona Editada', lugarServer: 'Zona Offline', periodoServer: '2026',
          }]),
        }),
      });
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });
      (mockSupabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: { code: PG_ERROR.UNIQUE_VIOLATION, message: 'duplicate key' } }),
      });

      await uploadOfflinePlantations();

      expect(mockSupabase.rpc).toHaveBeenCalledWith('editar_plantacion', {
        p_id: fakePendingPlantation.id, p_cambios: { lugar: 'Zona Editada' }, p_base: { lugar: 'Zona Offline' },
      });
    });

    const setsLocales = () => (mockDb.update as jest.Mock).mock.results.map((r) => r.value.set.mock.calls).flat();

    function conAltaYaSubidaQueNoSeActualiza(rechazo: string) {
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([fakePendingPlantation]) }),
      });
      (mockSupabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: { code: PG_ERROR.UNIQUE_VIOLATION, message: 'duplicate key' } }),
      });
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: false, error: rechazo }, error: null });
    }

    it('23505 sin fila con ese id (otra restricción única): falla y queda pendiente', async () => {
      conAltaYaSubidaQueNoSeActualiza('PLANTACION_INEXISTENTE');

      const [resultado] = await uploadOfflinePlantations();

      expect(resultado).toMatchObject({ success: false, error: 'UNKNOWN' });
      expect(setsLocales()).toEqual([[{ altaEnServidor: true }]]);
    });

    it('23505 sobre una plantación finalizada: queda pendiente con ese motivo', async () => {
      conAltaYaSubidaQueNoSeActualiza('PLANTACION_FINALIZADA');

      // Dentro de una corrida: fuera de ella no se guarda el motivo.
      const [resultado] = await conRegistroDeVarados(() => uploadOfflinePlantations(), REINTENTA_TODAS);

      expect(resultado).toMatchObject({ success: false, error: 'PLANTACION_FINALIZADA' });
      // Solo la marca de que el insert ya estaba en el server; sigue pendiente.
      expect(setsLocales()).toEqual([[{ altaEnServidor: true }]]);
      // Varada con ese motivo, para que la tarjeta lo muestre (#638).
      expect(guardarMotivoVarado).toHaveBeenCalledWith(fakePendingPlantation.id, 'finalizada');
    });

    it('23505 sin permiso de admin: SIN_PERMISO_CREAR, varada sin permiso (#638)', async () => {
      conAltaYaSubidaQueNoSeActualiza('NOT_AUTHORIZED');

      const [resultado] = await conRegistroDeVarados(() => uploadOfflinePlantations(), REINTENTA_TODAS);

      expect(resultado).toMatchObject({ success: false, error: 'SIN_PERMISO_CREAR' });
      expect(guardarMotivoVarado).toHaveBeenCalledWith(fakePendingPlantation.id, 'sin-permiso');
    });

    it('Test 6: non-23505 error — species upload is NOT called and pendingSync remains true (plantation skipped)', async () => {
      // Return pending plantation
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([fakePendingPlantation]),
        }),
      });

      // supabase.from returns a non-23505 error for plantation insert
      (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'plantations') {
          return {
            insert: jest.fn().mockResolvedValue({ error: { code: PG_ERROR.UNDEFINED_TABLE, message: 'table not found' } }),
          };
        }
        return { select: jest.fn().mockResolvedValue({ data: [], error: null }) };
      });

      const failResults = await uploadOfflinePlantations();

      // Las especies no suben: la plantación falló con un error no idempotente.
      expect(mockSupabase.rpc).not.toHaveBeenCalledWith('aplicar_cambios_especies', expect.anything());

      // pendingSync must NOT be updated to false (plantation was skipped)
      expect(mockDb.update).not.toHaveBeenCalled();

      // Failure is surfaced with the raw postgres detail.
      expect(failResults).toHaveLength(1);
      expect(failResults[0].success).toBe(false);
      if (failResults[0].success) return;
      expect(failResults[0].error).toBe('UNKNOWN');
      expect(failResults[0].detail).toContain(PG_ERROR.UNDEFINED_TABLE);
    });

    it('si fallan las especies, la plantación queda pendiente y el fallo se surfacea (#632)', async () => {
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([fakePendingPlantation]),
        }),
      });
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(fakePlantationSpecies),
        }),
      });
      (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'plantations') return { insert: jest.fn().mockResolvedValue({ error: null }) };
        return { select: jest.fn().mockResolvedValue({ data: [], error: null }) };
      });
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({
        data: null, error: { code: PG_ERROR.INSUFFICIENT_PRIVILEGE, message: 'rls' },
      });

      const res = await conRegistroDeVarados(() => uploadOfflinePlantations(), REINTENTA_TODAS);

      // Solo se guarda lo subido como snapshot (base del reintento): pendingSync sigue en true.
      const sets = (mockDb.update as jest.Mock).mock.results.map((r) => r.value.set.mock.calls).flat();
      expect(sets).not.toContainEqual([{ pendingSync: false }]);
      expect(sets[0][0]).toMatchObject({ lugarServer: fakePendingPlantation.lugar });
      expect(res).toHaveLength(1);
      expect(res[0].success).toBe(false);
      if (res[0].success) return;
      // 42501 durante el alta: el usuario ya no puede crearla (#638), no un permiso genérico.
      expect(res[0].error).toBe('SIN_PERMISO_CREAR');
      expect(guardarMotivoVarado).toHaveBeenCalledWith(fakePendingPlantation.id, 'sin-permiso');
    });

    it('Test 6b: el insert que LANZA (no devuelve {error}) se surfacea como NETWORK', async () => {
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([fakePendingPlantation]),
        }),
      });
      // insert RECHAZA (fetch failure que se propaga como throw).
      (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'plantations') {
          return { insert: jest.fn().mockRejectedValue(new Error('Network request failed')) };
        }
        return { upsert: jest.fn(), select: jest.fn().mockResolvedValue({ data: [], error: null }) };
      });

      const res = await uploadOfflinePlantations();

      expect(res).toHaveLength(1);
      expect(res[0].success).toBe(false);
      if (res[0].success) return;
      expect(res[0].error).toBe('NETWORK');
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('Test 7: no pending plantations — no server calls made', async () => {
      // Return empty list — no pending plantations
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      await uploadOfflinePlantations();

      // No supabase calls for plantations or species
      const fromCalls = (mockSupabase.from as jest.Mock).mock.calls;
      expect(fromCalls.some(([t]) => t === 'plantations')).toBe(false);
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // ─── uploadPendingEdits ────────────────────────────────────────────────────

  describe('uploadPendingEdits', () => {
    const plantacionEditada = {
      ...fakePendingPlantation, pendingSync: false, pendingEdit: true, lugar: 'Zona Editada', lugarServer: 'Zona Offline',
      baseDeEdicion: null as Record<string, unknown> | null, conflictosDeEdicion: null,
    };

    function conEdicionPendiente(respuesta: unknown, fila: Record<string, unknown> = plantacionEditada) {
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([fila]) }),
      });
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: respuesta, error: null });
    }

    function setLocal() {
      return (mockDb.update as jest.Mock).mock.results[0]?.value.set;
    }

    it('sube por editar_plantacion solo lo que cambió, con su base, y limpia pendingEdit', async () => {
      conEdicionPendiente({ success: true });

      const [subida] = await uploadPendingEdits();

      expect(mockSupabase.rpc).toHaveBeenCalledWith('editar_plantacion', {
        p_id: plantacionEditada.id, p_cambios: { lugar: 'Zona Editada' }, p_base: { lugar: 'Zona Offline' },
      });
      expect(setLocal()).toHaveBeenCalledWith(expect.objectContaining({ pendingEdit: false, baseDeEdicion: null }));
      expect(subida).toMatchObject({ success: true, cambiosPorResolver: 0 });
    });

    it('la base guardada al editar gana sobre el snapshot que refrescó el pull', async () => {
      conEdicionPendiente({ success: true }, { ...plantacionEditada, lugarServer: 'Cambiada en la web', baseDeEdicion: { lugar: 'Zona Offline' } });

      await uploadPendingEdits();

      expect((mockSupabase.rpc as jest.Mock).mock.calls[0][1].p_base).toEqual({ lugar: 'Zona Offline' });
    });

    it('un rechazo del server NO limpia pendingEdit', async () => {
      conEdicionPendiente({ success: false, error: 'PLANTACION_FINALIZADA' });

      expect(await conRegistroDeVarados(() => uploadPendingEdits(), REINTENTA_TODAS)).toEqual([]);
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(guardarMotivoVarado).toHaveBeenCalledWith(expect.any(String), 'finalizada');
    });

    it('un error de red no marca nada: se reintenta (#638)', async () => {
      conEdicionPendiente(null);
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: { message: 'TypeError: Network request failed' } });

      expect(await uploadPendingEdits()).toEqual([]);
      expect(guardarMotivoVarado).not.toHaveBeenCalled();
      expect(limpiarMotivoVarado).not.toHaveBeenCalled();
    });

    it('un conflicto deja el valor de la web y lo guarda para resolver', async () => {
      conEdicionPendiente({
        success: false, error: 'CONFLICTO_EDICION', aplicados: [],
        conflictos: [{ campo: 'lugar', valor_servidor: 'Zona Web', editado_por: 'Ana', editado_en: null }],
      });

      const [subida] = await uploadPendingEdits();

      expect(subida).toMatchObject({ success: true, cambiosPorResolver: 1 });
      expect(setLocal()).toHaveBeenCalledWith(expect.objectContaining({
        lugar: 'Zona Web', lugarServer: 'Zona Web', pendingEdit: false,
        conflictosDeEdicion: [expect.objectContaining({ campo: 'lugar', mio: 'Zona Editada', web: 'Zona Web', anterior: 'Zona Offline' })],
      }));
    });
  });
});
