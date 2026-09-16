/**
 * Los pre-steps corren ANTES del primer evento de progreso, así que el watchdog de
 * 45s dispara justo ahí si el catálogo o el push de plantaciones offline se cuelga.
 * Con los `catch` de "seguir ante fallas" tragándose la cancelación, el botón no
 * hacía nada durante todo ese tramo (#451).
 */
jest.mock('../../src/database/client', () => ({
  db: { select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn().mockResolvedValue([]) })) })) },
  sqlite: undefined,
}));
jest.mock('../../src/database/liveQuery', () => ({ notifyDataChanged: jest.fn() }));
jest.mock('../../src/utils/syncLogger', () => ({
  syncLog: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockSelect = jest.fn();
jest.mock('../../src/supabase/client', () => ({
  supabase: {
    from: () => ({ select: mockSelect }),
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) },
  },
  isSupabaseConfigured: true,
}));

import { runGlobalPreSteps } from '../../src/services/sync/preSteps';
import { cancelarCorrida, iniciarCorrida, SyncCanceladoError, terminarCorrida } from '../../src/services/sync/cancelacion';

describe('runGlobalPreSteps — cancelación', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => terminarCorrida());

  it('cancelar durante los pre-steps corta, no sigue de largo', async () => {
    iniciarCorrida();
    cancelarCorrida();

    await expect(runGlobalPreSteps()).rejects.toBeInstanceOf(SyncCanceladoError);
  });

  // El contraste: un catálogo que no se pudo bajar es aceptable (queda stale) y no
  // debe frenar el push de lo que el técnico cargó.
  it('un catálogo que falla por red no frena los pre-steps', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: 'Network request failed' } });

    await expect(runGlobalPreSteps()).resolves.toEqual([]);
  });
});
