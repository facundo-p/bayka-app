// Role-gated server catalog query and local plantation ID lookup

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
  isSupabaseConfigured: true,
}));

jest.mock('../../src/database/client', () => ({
  db: {
    select: jest.fn(),
  },
}));

const { supabase } = require('../../src/supabase/client');
const { db } = require('../../src/database/client');

import {
  getServerCatalog,
  getLocalPlantationIds,
  ServerPlantation,
} from '../../src/queries/catalogQueries';

const makePlantation = (id: string): any => ({
  id,
  organizacion_id: 'org-1',
  lugar: 'Lugar Test',
  periodo: '2026',
  estado: 'activa',
  creado_por: 'user-admin',
  created_at: '2026-01-01T00:00:00Z',
});

// Admin plantations chain (select().eq().order()); non-jest functions survive clearAllMocks()
function makeOrderTerminalChain(resolvedValue: any) {
  const chain: any = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.in = () => chain;
  chain.order = () => Promise.resolve(resolvedValue);
  return chain;
}

// Tecnico plantation_users chain, terminal at eq() (select().eq())
function makeEqTerminalChain(resolvedValue: any) {
  const eqSpy = jest.fn().mockResolvedValue(resolvedValue);
  const chain: any = {
    select: () => chain,
    eq: eqSpy,
  };
  return chain;
}

// Groups/trees count chain, terminal at in() (select().eq().in())
function makeInTerminalChain(resolvedValue: any) {
  const chain: any = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.in = () => Promise.resolve(resolvedValue);
  return chain;
}

describe('catalogQueries', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── getServerCatalog ─────────────────────────────────────────────────────────

  describe('getServerCatalog — admin path', () => {
    it('Test 1: admin path queries plantations filtered by organizacion_id', async () => {
      const remotePlantations = [makePlantation('p-1'), makePlantation('p-2')];

      const eqCalls: any[] = [];
      const plantationsChain: any = {};
      plantationsChain.select = () => plantationsChain;
      plantationsChain.eq = (...args: any[]) => { eqCalls.push(args); return plantationsChain; };
      plantationsChain.in = () => plantationsChain;
      plantationsChain.order = () => Promise.resolve({ data: remotePlantations, error: null });

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(plantationsChain)
        .mockReturnValueOnce(makeInTerminalChain({ data: [], error: null }))  // groups
        .mockReturnValueOnce(makeInTerminalChain({ data: [], error: null })); // trees

      const results = await getServerCatalog(true, 'user-admin', 'org-1');

      expect(supabase.from).toHaveBeenCalledWith('plantations');
      expect(eqCalls).toContainEqual(['organizacion_id', 'org-1']);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('p-1');
    });
  });

  describe('getServerCatalog — tecnico path', () => {
    it('Test 2: tecnico path queries plantation_users first, then fetches assigned plantations', async () => {
      const assignedPu = [{ plantation_id: 'p-1' }];
      const remotePlantations = [makePlantation('p-1')];

      const puEqCalls: any[] = [];
      const puChain: any = {
        select: () => puChain,
        eq: (...args: any[]) => { puEqCalls.push(args); return Promise.resolve({ data: assignedPu, error: null }); },
      };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(puChain)
        .mockReturnValueOnce(makeOrderTerminalChain({ data: remotePlantations, error: null }))
        .mockReturnValueOnce(makeInTerminalChain({ data: [], error: null }))
        .mockReturnValueOnce(makeInTerminalChain({ data: [], error: null }));

      const results = await getServerCatalog(false, 'user-tec', 'org-1');

      expect(supabase.from).toHaveBeenCalledWith('plantation_users');
      expect(puEqCalls).toContainEqual(['user_id', 'user-tec']);
      const fromCalls = (supabase.from as jest.Mock).mock.calls.map((c: any) => c[0]);
      expect(fromCalls).toContain('plantations');
      expect(results).toHaveLength(1);
    });

    it('Test 3: tecnico with no assignments returns empty array without querying plantations', async () => {
      const puChain: any = {
        select: () => puChain,
        eq: () => Promise.resolve({ data: [], error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValueOnce(puChain);

      const results = await getServerCatalog(false, 'user-tec', 'org-1');

      expect(results).toEqual([]);
      // No plantations call — only plantation_users
      expect(supabase.from).toHaveBeenCalledTimes(1);
    });
  });

  describe('getServerCatalog — counts', () => {
    it('Test 5: merges subgroup and tree counts into results', async () => {
      const remotePlantations = [makePlantation('p-1')];

      const subgroupsData = [
        { plantation_id: 'p-1', id: 'sg-1' },
        { plantation_id: 'p-1', id: 'sg-2' },
      ];

      const treesData = [
        { group_id: 'sg-1' },
        { group_id: 'sg-1' },
        { group_id: 'sg-2' },
      ];

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(makeOrderTerminalChain({ data: remotePlantations, error: null }))
        .mockReturnValueOnce(makeInTerminalChain({ data: subgroupsData, error: null }))
        .mockReturnValueOnce(makeInTerminalChain({ data: treesData, error: null }));

      const results = await getServerCatalog(true, 'user-admin', 'org-1');

      expect(results).toHaveLength(1);
      expect(results[0].group_count).toBe(2);
      expect(results[0].tree_count).toBe(3);
    });

    it('Test 5b: defaults to 0 counts when no groups or trees for plantation', async () => {
      const remotePlantations = [makePlantation('p-empty')];

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(makeOrderTerminalChain({ data: remotePlantations, error: null }))
        .mockReturnValueOnce(makeInTerminalChain({ data: [], error: null }))
        .mockReturnValueOnce(makeInTerminalChain({ data: [], error: null }));

      const results = await getServerCatalog(true, 'user-admin', 'org-1');

      expect(results[0].group_count).toBe(0);
      expect(results[0].tree_count).toBe(0);
    });
  });

  describe('getServerCatalog — visible_in_app', () => {
    it('mapea visible_in_app y defaultea true cuando el server no trae la columna', async () => {
      const remotePlantations = [
        { ...makePlantation('p-oculta'), visible_in_app: false },
        makePlantation('p-sin-columna'), // server sin la migración → visible
      ];

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(makeOrderTerminalChain({ data: remotePlantations, error: null }))
        .mockReturnValueOnce(makeInTerminalChain({ data: [], error: null }))
        .mockReturnValueOnce(makeInTerminalChain({ data: [], error: null }));

      const results = await getServerCatalog(true, 'user-admin', 'org-1');

      expect(results.find((p) => p.id === 'p-oculta')?.visible_in_app).toBe(false);
      expect(results.find((p) => p.id === 'p-sin-columna')?.visible_in_app).toBe(true);
    });
  });

  describe('getServerCatalog — error handling', () => {
    it('Test 6: throws error when supabase plantations query fails', async () => {
      const errorChain: any = {};
      errorChain.select = () => errorChain;
      errorChain.eq = () => errorChain;
      errorChain.in = () => errorChain;
      errorChain.order = () => Promise.resolve({ data: null, error: new Error('DB Error') });

      (supabase.from as jest.Mock).mockReturnValueOnce(errorChain);

      await expect(getServerCatalog(true, 'user-admin', 'org-1')).rejects.toBeTruthy();
    });
  });

  // ─── getLocalPlantationIds ────────────────────────────────────────────────────

  describe('getLocalPlantationIds', () => {
    it('Test 4: returns Set of local plantation IDs from SQLite', async () => {
      const mockRows = [{ id: 'p-1' }, { id: 'p-2' }, { id: 'p-3' }];

      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockResolvedValue(mockRows),
      });

      const result = await getLocalPlantationIds();

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(3);
      expect(result.has('p-1')).toBe(true);
      expect(result.has('p-3')).toBe(true);
    });

    it('returns empty Set when no local plantations', async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockResolvedValue([]),
      });

      const result = await getLocalPlantationIds();

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });
});
