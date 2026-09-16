import { classifyServerError, getErrorMessage, SYNC_ERROR } from '../../src/services/sync/types';
import { classifyRpcResult } from '../../src/services/sync/pushService';
import { MARCA_DE_TIMEOUT } from '../../src/supabase/fetchConTimeout';

const errorDeTimeout = { message: `${MARCA_DE_TIMEOUT}: sin respuesta en 30000ms — /rest/v1/trees` };

describe('classifyServerError — TIMEOUT (#451)', () => {
  // Sin código de postgres, un timeout caía en NETWORK: indistinguible de "no hay
  // señal", que para el técnico es un problema distinto y con otra salida.
  it('un timeout no se clasifica como error de red', () => {
    expect(classifyServerError(errorDeTimeout).error).toBe(SYNC_ERROR.TIMEOUT);
  });

  it('un fallo de red de verdad sigue siendo NETWORK', () => {
    expect(classifyServerError({ message: 'Network request failed' }).error).toBe(SYNC_ERROR.NETWORK);
  });

  it('un rechazo de RLS sigue siendo PERMISSION', () => {
    expect(classifyServerError({ code: '42501', message: 'new row violates policy' }).error).toBe(SYNC_ERROR.PERMISSION);
  });

  it('conserva el detalle crudo para diagnosticar', () => {
    expect(classifyServerError(errorDeTimeout).detail).toContain(MARCA_DE_TIMEOUT);
  });

  it('tiene un mensaje propio, distinto del de red', () => {
    expect(getErrorMessage(SYNC_ERROR.TIMEOUT)).not.toBe(getErrorMessage(SYNC_ERROR.NETWORK));
    expect(getErrorMessage(SYNC_ERROR.TIMEOUT)).toBeTruthy();
  });
});

/** El push de grupos es el camino dominante y no pasaba por `classifyServerError`. */
describe('classifyRpcResult — TIMEOUT (#451)', () => {
  const grupo = { id: 'g-1', nombre: 'Linea A', parcelaId: 'parc-1' };

  it('un timeout del RPC no se reporta como error de red', () => {
    const resultado = classifyRpcResult(grupo, null, errorDeTimeout);

    expect(resultado).toMatchObject({ success: false, error: SYNC_ERROR.TIMEOUT });
  });

  it('un error de red del RPC sigue siendo NETWORK', () => {
    const resultado = classifyRpcResult(grupo, null, { message: 'Network request failed' });

    expect(resultado).toMatchObject({ success: false, error: SYNC_ERROR.NETWORK });
  });

  it('el camino feliz no cambia', () => {
    expect(classifyRpcResult(grupo, { success: true }, null)).toMatchObject({ success: true });
  });
});
