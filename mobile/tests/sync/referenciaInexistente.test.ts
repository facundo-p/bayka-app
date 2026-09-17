jest.mock('../../src/supabase/client', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn(), auth: { getUser: jest.fn() }, storage: { from: jest.fn() } },
  isSupabaseConfigured: true,
}));
jest.mock('../../src/database/client', () => ({
  db: { select: jest.fn(), update: jest.fn() },
}));
jest.mock('../../src/database/liveQuery', () => ({
  notifyDataChanged: jest.fn(),
}));

import { classifyServerError, getErrorMessage } from '../../src/services/sync/types';
import { classifyParcelaRpcResult } from '../../src/services/sync/pushService';

// 23503: la fila padre no existe en el server (p.ej. la plantación de una parcela).
const errorDeFk = {
  code: '23503',
  message: 'insert or update on table "parcelas" violates foreign key constraint "parcelas_plantation_id_fkey"',
  details: 'Key (plantation_id)=(11111111-1111-1111-1111-111111111111) is not present in table "plantations".',
};

describe('violación de FK (23503) — #483', () => {
  it('classifyServerError la clasifica con código propio, no UNKNOWN', () => {
    expect(classifyServerError(errorDeFk).error).toBe('REFERENCIA_INEXISTENTE');
  });

  it('conserva el detalle crudo para diagnosticar', () => {
    expect(classifyServerError(errorDeFk).detail).toContain('23503');
  });

  it('tiene un mensaje propio, distinto del genérico', () => {
    const mensaje = getErrorMessage('REFERENCIA_INEXISTENTE');
    expect(mensaje).toBeTruthy();
    expect(mensaje).not.toBe(getErrorMessage('UNKNOWN'));
  });

  it('el push de parcelas la reporta con su código y detalle', () => {
    const resultado = classifyParcelaRpcResult({ id: 'parc-1', nombre: 'Lote 1' }, null, errorDeFk);

    expect(resultado).toMatchObject({ success: false, error: 'REFERENCIA_INEXISTENTE' });
    if (resultado.success) return;
    expect(resultado.detail).toContain('23503');
  });
});
