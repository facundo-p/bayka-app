// Chequeo de acceso del pull con `estado_remoto_plantaciones` (#478). Solo los casos
// que cortan antes de bajar datos; el pull completo lo cubre tests/integration.

jest.mock('../../src/supabase/client', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn(), auth: { getSession: jest.fn() } },
  isSupabaseConfigured: true,
}));
jest.mock('../../src/database/client', () => ({ db: { select: jest.fn() } }));
jest.mock('../../src/repositories/EliminadaEnServidorRepository', () => ({
  marcarEliminadaEnServidor: jest.fn(),
  desmarcarEliminadaEnServidor: jest.fn(),
}));

import { pullFromServer } from '../../src/services/sync/pullService';
import { conUsuarioCacheado } from '../helpers/rolCacheado';
import { supabase } from '../../src/supabase/client';
import { db } from '../../src/database/client';
import { marcarEliminadaEnServidor, desmarcarEliminadaEnServidor } from '../../src/repositories/EliminadaEnServidorRepository';

function membresia(filas: unknown[]) {
  const eq2 = jest.fn().mockResolvedValue({ data: filas, error: null });
  (supabase.from as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ eq: eq2 }) }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (db.select as jest.Mock).mockReturnValue({
    from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ pendingSync: false }]) }),
  });
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: { id: 'u-1' } } } });
  conUsuarioCacheado('u-1');
});

describe('pullFromServer — acceso remoto', () => {
  it('eliminada: marca la plantación y no baja nada', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: [{ id: 'p-1', estado: 'eliminada' }], error: null });

    expect(await pullFromServer('p-1')).toEqual({ estado: 'eliminada' });

    expect(supabase.rpc).toHaveBeenCalledWith('estado_remoto_plantaciones', { p_ids: ['p-1'] });
    expect(marcarEliminadaEnServidor).toHaveBeenCalledWith('p-1');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('sin_acceso: corta sin tocar la marca', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: [{ id: 'p-1', estado: 'sin_acceso' }], error: null });

    expect(await pullFromServer('p-1')).toEqual({ estado: 'sin-acceso' });

    expect(marcarEliminadaEnServidor).not.toHaveBeenCalled();
    expect(desmarcarEliminadaEnServidor).not.toHaveBeenCalled();
  });

  it.each(['42883', 'PGRST202'])('RPC inexistente (%s): cae al chequeo de membresía', async (code) => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: { code, message: 'no existe' } });
    membresia([]);

    expect(await pullFromServer('p-1')).toEqual({ estado: 'sin-acceso' });

    expect(supabase.from).toHaveBeenCalledWith('plantation_users');
  });

  it('plantación creada offline: ni consulta el server', async () => {
    (db.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ pendingSync: true }]) }),
    });
    (supabase.from as jest.Mock).mockImplementation(() => { throw new Error('corta el pull'); });

    await expect(pullFromServer('p-1')).rejects.toThrow('corta el pull');

    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
