// Tests for PlantationRepository — admin mutation functions
// (La generación de IDs se movió a la web server-side — issue #232.)

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: { getSession: jest.fn(), refreshSession: jest.fn() },
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

jest.mock('../../src/utils/syncLogger', () => ({
  syncLog: { info: jest.fn(), error: jest.fn() },
}));

jest.mock('../../src/queries/catalogQueries', () => ({
  getResumenDePendientes: jest.fn(),
}));

import {
  finalizePlantation,
  FinalizePlantationLocalSyncError,
  FinalizePlantationPendientesError,
  reabrirPlantacion,
  ReabrirPlantacionLocalSyncError,
} from '../../src/repositories/PlantationRepository';

import { supabase } from '../../src/supabase/client';
import { db } from '../../src/database/client';
import { notifyDataChanged } from '../../src/database/liveQuery';
import { syncLog } from '../../src/utils/syncLogger';
import { getResumenDePendientes } from '../../src/queries/catalogQueries';
import { conSesionDelServidor } from '../helpers/rolCacheado';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockDb = db as jest.Mocked<typeof db>;
const mockNotifyDataChanged = notifyDataChanged as jest.Mock;
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
    conSesionDelServidor(mockSupabase.auth, 'user-1');

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

  // ─── finalizePlantation ───────────────────────────────────────────────────

  describe('finalizePlantation', () => {
    const SIN_PENDIENTES = { activaCount: 0, finalizadaCount: 0, parcelas: 0, fotos: 0, borrados: 0, especies: 0, tecnicos: 0 };

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
    it('updates estado to "finalizada" on BOTH supabase and local SQLite', async () => {
      await finalizePlantation('plantation-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('plantations');
      const fromResult = (mockSupabase.from as jest.Mock).mock.results[0].value;
      expect(fromResult.update).toHaveBeenCalledWith({ estado: 'finalizada' });

      expect(mockDb.update).toHaveBeenCalled();
      const updateResult = (mockDb.update as jest.Mock).mock.results[0].value;
      expect(updateResult.set).toHaveBeenCalledWith({ estado: 'finalizada' });
    });

    it('calls notifyDataChanged after updates', async () => {
      await finalizePlantation('plantation-1');

      expect(mockNotifyDataChanged).toHaveBeenCalledTimes(1);
    });

    it('server ok + local fails — throws FinalizePlantationLocalSyncError, logs, does NOT notify', async () => {
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

    it('sin sesión del servidor: no escribe nada y pide iniciar sesión con conexión (#658)', async () => {
      conSesionDelServidor(mockSupabase.auth, null);

      await expect(finalizePlantation('plantation-1')).rejects.toThrow(
        'Iniciá sesión con conexión para finalizar la plantación.',
      );

      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('server fails — local SQLite untouched, error del server se propaga', async () => {
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

  // ─── reabrirPlantacion (#637) ─────────────────────────────────────────────

  describe('reabrirPlantacion', () => {
    it('llama al RPC y deja la plantación activa en SQLite', async () => {
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      await reabrirPlantacion('plantation-1');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('reabrir_plantacion', { p_id: 'plantation-1' });
      const updateResult = (mockDb.update as jest.Mock).mock.results[0].value;
      expect(updateResult.set).toHaveBeenCalledWith({ estado: 'activa' });
      expect(mockNotifyDataChanged).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['NOT_AUTHORIZED', 'Solo un superadmin puede reabrir una plantación.'],
      ['PLANTACION_ARCHIVADA', 'La plantación está archivada: desarchivala antes de reabrirla.'],
      ['OTRO', 'No se pudo reabrir la plantación. Probá de nuevo.'],
    ])('rechazo %s del server: no toca SQLite y avisa con el mensaje de la web', async (codigo, mensaje) => {
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: false, error: codigo }, error: null });

      await expect(reabrirPlantacion('plantation-1')).rejects.toThrow(mensaje);

      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('sin sesión del servidor: no llama al RPC y pide iniciar sesión con conexión (#658)', async () => {
      conSesionDelServidor(mockSupabase.auth, null);

      await expect(reabrirPlantacion('plantation-1')).rejects.toThrow(
        'Iniciá sesión con conexión para reabrir la plantación.',
      );

      expect(mockSupabase.rpc).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('error de red: mensaje genérico, SQLite intacto', async () => {
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: { message: 'Network request failed' } });

      await expect(reabrirPlantacion('plantation-1')).rejects.toThrow('No se pudo reabrir la plantación. Probá de nuevo.');

      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('server ok + local falla: ReabrirPlantacionLocalSyncError, sin notificar', async () => {
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });
      (mockDb.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockRejectedValue(new Error('SQLITE_BUSY')),
        }),
      });

      await expect(reabrirPlantacion('plantation-1')).rejects.toThrow(ReabrirPlantacionLocalSyncError);

      expect(mockNotifyDataChanged).not.toHaveBeenCalled();
    });
  });
});
