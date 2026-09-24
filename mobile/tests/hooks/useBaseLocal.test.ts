const mockMigraciones = { success: false, error: undefined as Error | undefined };
const mockActivar = jest.fn();

jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: () => mockMigraciones,
}));
jest.mock('../../drizzle/migrations', () => ({}));
jest.mock('../../src/database/integridadReferencial', () => ({
  activarIntegridadReferencial: (...args: unknown[]) => mockActivar(...args),
}));

import { renderHook } from '@testing-library/react-native';
import { useBaseLocal } from '../../src/hooks/useBaseLocal';

describe('useBaseLocal', () => {
  beforeEach(() => {
    mockActivar.mockClear();
    mockMigraciones.success = false;
  });

  it('no activa las FKs mientras las migraciones no terminan', () => {
    const { result } = renderHook(() => useBaseLocal());
    expect(mockActivar).not.toHaveBeenCalled();
    expect(result.current.success).toBe(false);
  });

  it('activa las FKs después de migrar y recién ahí da la base por lista', () => {
    mockMigraciones.success = true;
    const { result } = renderHook(() => useBaseLocal());
    expect(mockActivar).toHaveBeenCalledTimes(1);
    expect(result.current.success).toBe(true);
  });
});
