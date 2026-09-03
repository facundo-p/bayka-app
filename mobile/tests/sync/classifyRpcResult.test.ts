/**
 * Tests de classifyRpcResult (push de grupos vía RPC sync_subgroup).
 * Issue #67: el RPC devuelve 'PERMISSION' cuando el caller no es miembro de
 * la plantación, y el cliente debe pasarlo tal cual (no colapsar a UNKNOWN).
 */

jest.mock('../../src/supabase/client', () => ({
  supabase: { rpc: jest.fn(), auth: { getUser: jest.fn() }, storage: { from: jest.fn() } },
  isSupabaseConfigured: true,
}));
jest.mock('../../src/database/client', () => ({
  db: { select: jest.fn(), update: jest.fn() },
}));
jest.mock('../../src/database/liveQuery', () => ({
  notifyDataChanged: jest.fn(),
}));

import { classifyRpcResult } from '../../src/services/sync/pushService';

const sg = { id: 'group-1', nombre: 'G1', parcelaId: 'parcela-1' };

describe('classifyRpcResult', () => {
  test('success true del RPC → success', () => {
    const result = classifyRpcResult(sg, { success: true }, null);
    expect(result).toEqual({ success: true, groupId: 'group-1', nombre: 'G1' });
  });

  test('error de transporte → NETWORK', () => {
    const result = classifyRpcResult(sg, null, { message: 'fetch failed' });
    expect(result).toMatchObject({ success: false, error: 'NETWORK' });
  });

  test('RPC rechaza con DUPLICATE_CODE → passthrough', () => {
    const result = classifyRpcResult(sg, { success: false, error: 'DUPLICATE_CODE' }, null);
    expect(result).toMatchObject({ success: false, error: 'DUPLICATE_CODE' });
  });

  test('RPC rechaza con PERMISSION (guard de membresía #67) → passthrough', () => {
    const result = classifyRpcResult(sg, { success: false, error: 'PERMISSION' }, null);
    expect(result).toMatchObject({ success: false, error: 'PERMISSION' });
  });

  test('código desconocido del RPC → UNKNOWN', () => {
    const result = classifyRpcResult(sg, { success: false, error: 'ALGO_NUEVO' }, null);
    expect(result).toMatchObject({ success: false, error: 'UNKNOWN' });
  });
});
