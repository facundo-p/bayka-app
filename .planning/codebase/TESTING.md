# Testing Patterns

**Analysis Date:** 2026-04-12

## Test Framework

**Runner:**
- Jest 29.7.0
- Preset: `jest-expo` with Expo SDK 54 support
- Config: `mobile/jest.config.js` (unit/integration), `mobile/jest.integration.config.js` (real SQLite)

**Assertion Library:**
- Jest native `expect()` assertions
- No additional assertion libraries (Chai, Vitest, etc.)

**Run Commands:**
```bash
npm run lint                    # Run ESLint checks (mobile/ directory)
npm test                        # Run unit tests (jest.config.js) — mocked expo-sqlite
npm test -- jest.integration   # Run integration tests (jest.integration.config.js) — real better-sqlite3
npm test -- --watch            # Watch mode for unit tests
npm test -- --coverage         # Coverage report
```

## Test File Organization

**Location:**
- Unit tests: `mobile/tests/**/*.test.ts` or `mobile/tests/**/*.test.tsx`
- Mocked tests and unit suites in same directory structure as source
- Integration tests: `mobile/tests/integration/**/*.test.ts`

**Naming:**
- Unit test files: `{SourceFile}.test.ts` (e.g., `TreeRepository.test.ts` tests `TreeRepository.ts`)
- Test suite name matches source: `describe('TreeRepository', () => {...})`
- Test cases use human-readable names: `it('inserts tree with auto-incremented position (TREE-02, TREE-03)', async () => {...})`

**Directory Structure:**
```
mobile/tests/
├── __mocks__/               # Module mocks (expo-file-system.js, expoWinterRuntime.js, etc.)
├── jestSetup.js             # Global setup (structuredClone polyfill)
├── setup.ts                 # Unit test mocks (AsyncStorage, SecureStore, NetInfo, etc.)
├── setup.integration.ts     # Integration test setup (real SQLite via better-sqlite3)
├── auth/                    # Auth-related tests
│   ├── offlineAuth.test.ts
│   ├── role.test.ts
│   ├── session.test.ts
│   └── ...
├── database/                # Database & Drizzle tests
│   ├── tree.test.ts
│   ├── subgroup.test.ts
│   └── migrations.test.ts
├── repositories/            # Repository layer tests
│   ├── TreeRepository.test.ts
│   └── ...
├── sync/                    # Sync service tests
│   ├── SyncService.test.ts
│   ├── SyncService.offline.test.ts
│   └── downloadService.test.ts
├── queries/                 # Query layer tests
│   ├── catalogQueries.test.ts
│   └── ...
├── hooks/                   # Custom hook tests
│   ├── useAuth.test.ts
│   ├── useSync.test.ts
│   └── ...
└── integration/             # End-to-end integration tests
    ├── tree-registration.test.ts
    ├── offlineAuthCycle.test.ts
    ├── sync-pipeline.test.ts
    └── subgroup-lifecycle.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
// Example: TreeRepository.test.ts

// 1. Mock setup (hoisted before imports)
jest.mock('../../src/database/client', () => ({
  get db() { return mockDb; }
}));

// 2. Mock object definitions
let mockDb: any;
let mockSelectResults: any[] = [];
let mockInsertValues: jest.Mock;

// 3. Setup hooks
beforeAll(() => {
  mockInsertValues = jest.fn().mockResolvedValue(undefined);
  mockDb = { insert: jest.fn(() => ({ values: mockInsertValues })), ... };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSelectResults = [];
  mockInsertValues.mockResolvedValue(undefined);
});

// 4. Imports (after mocks defined)
import { insertTree, deleteLastTree } from '../../src/repositories/TreeRepository';

// 5. Test suites
describe('TreeRepository', () => {
  describe('insertTree', () => {
    it('first tree in subgroup gets posicion=1 (TREE-03)', async () => {
      mockSelectResults = [{ maxPos: null }];
      const result = await insertTree({
        subgrupoId: 'sg-1',
        subgrupoCodigo: 'L1',
        especieId: 'esp-1',
        especieCodigo: 'ANC',
        userId: 'user-1',
      });
      expect(result.posicion).toBe(1);
      expect(result.subId).toBe('L1ANC1');
    });
  });
});
```

**Patterns:**

1. **Mock Definition Pattern** — Drizzle ORM chain mocking:
```typescript
mockDb = {
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => Promise.resolve(mockSelectResults)),
      orderBy: jest.fn(() => ({ where: jest.fn(() => Promise.resolve(mockSelectResults)) })),
    })),
  })),
  insert: jest.fn(() => ({ values: mockInsertValues })),
  update: jest.fn(() => ({ set: jest.fn(() => ({ where: mockUpdateWhere })) })),
  transaction: jest.fn(async (fn) => { const tx = { ... }; await fn(tx); }),
};
```

2. **Setup Pattern** — Module-level state for shared mocks:
```typescript
let mockSelectResults: any[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  mockSelectResults = [];  // Reset for each test
});
```

3. **Assertion Pattern** — Semantic expectations with feature codes:
```typescript
it('generates correct subId (TREE-04)', async () => {
  const result = await insertTree({...});
  expect(result.subId).toBe('L23BANC13');
  expect(mockInsertValues).toHaveBeenCalledTimes(1);
  const row = mockInsertValues.mock.calls[0][0];
  expect(row.posicion).toBe(1);
});
```

## Mocking

**Framework:** Jest native `jest.mock()` and `jest.fn()`

**Patterns:**

1. **Module Mocking** — Define mock before imports:
```typescript
jest.mock('../../src/database/client', () => ({
  get db() { return mockDb; }
}));
```

2. **Async Mock Resolution:**
```typescript
const mockInsertValues = jest.fn().mockResolvedValue(undefined);
const mockSelectResults = jest.fn().mockResolvedValue([]);
```

3. **Call Inspection** — Verify calls with mock.calls:
```typescript
expect(mockInsertValues).toHaveBeenCalledTimes(1);
const row = mockInsertValues.mock.calls[0][0];
expect(row.posicion).toBe(1);
```

**What to Mock:**
- Database client (`src/database/client.ts`) — all repository tests mock `db`
- Supabase client (`src/supabase/client.ts`) — sync and auth tests mock `supabase`
- File system (`expo-file-system`) — photo/storage tests mock file operations
- Crypto (`expo-crypto`) — randomUUID, digestStringAsync mocked for deterministic UUIDs
- Storage (`expo-secure-store`, `@react-native-async-storage/async-storage`) — all auth/offline tests mock
- NetInfo (`@react-native-community/netinfo`) — offline tests set `isConnected: false`
- Expo runtime modules that aren't available in Node.js

**What NOT to Mock:**
- Domain repositories/queries being tested — test real logic, not mocks
- URL/path utilities — test actual behavior
- Date/time utilities — use real dates (or mock only when testing timezone behavior)
- Redux/state management — use real slices if present (none in this project)

## Fixtures and Factories

**Test Data:**

1. **In-memory Database Simulation** (`tests/setup.ts`):
```typescript
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  ...
}));

(AsyncStorage.getItem as jest.Mock).mockImplementation(async (key) => store.get(key) ?? null);
(AsyncStorage.setItem as jest.Mock).mockImplementation(async (key, value) => {
  store.set(key, value);
});
```

2. **SecureStore Simulation** (in offline auth tests):
```typescript
let store: Map<string, string> = new Map();

(SecureStore.getItemAsync as jest.Mock).mockImplementation(
  async (key: string) => store.get(key) ?? null
);
```

3. **Mock Tree Fixtures** (`TreeRepository.test.ts`):
```typescript
mockSelectResults = [
  { id: 'tree-1', posicion: 1, especieId: 'esp-1', subId: 'L1ANC1', ... },
  { id: 'tree-2', posicion: 2, especieId: 'esp-1', subId: 'L1ANC2', ... },
];
```

**Location:**
- Fixtures defined inline in test files (small, focused tests)
- No factory libraries used — direct object creation with defaults
- Mock data kept minimal (only required fields for test case)

## Coverage

**Requirements:** No enforced target — coverage is **informational only**

**View Coverage:**
```bash
npm test -- --coverage
# Or with integration tests:
npm test -- jest.integration --coverage
```

**Coverage Output:**
- Statements, Lines, Functions, Branches coverage percentages
- Report generated to terminal and `coverage/` directory
- Actual coverage ~75-85% across codebase (varies by module)

**Coverage Observations:**
- High coverage on repositories, queries, services
- Lower coverage on UI components (harder to test, less critical)
- Integration tests focus on end-to-end workflows, not line coverage

## Test Types

**Unit Tests** (45 files, ~3000 lines total):
- Scope: Single function or method in isolation
- Mocks: All external dependencies (database, Supabase, file system)
- Speed: <5ms per test, entire suite <5s
- Location: `tests/auth/`, `tests/database/`, `tests/repositories/`, `tests/queries/`, `tests/hooks/`
- Examples:
  - `insertTree()` with mocked DB returns correct `posicion`
  - `verifyCredential()` rejects wrong password
  - `useAuth()` updates session on login event

**Integration Tests** (4 files, ~1500 lines total):
- Scope: Multi-component workflows (auth → sync → download → trees)
- Mocks: Supabase only; database is REAL SQLite via better-sqlite3
- Speed: 1-5s per test (slower due to real DB I/O)
- Location: `tests/integration/`
- Examples:
  - `tree-registration.test.ts` — create plantation → subgroup → register tree → reverse order → verify DB state
  - `offlineAuthCycle.test.ts` — offline login → create local data → sync when online
  - `sync-pipeline.test.ts` — pull catalog → sync subgroups → upload photos → verify state changes

**E2E Tests:** Not used. Integration tests serve this purpose with real database.

## Common Patterns

**Async Testing:**
```typescript
// Pattern 1: Async/await with try-catch
it('handles async operations', async () => {
  const result = await insertTree({ ... });
  expect(result.posicion).toBe(1);
});

// Pattern 2: Promise chain with .then()
it('resolves promise', () => {
  return verifyCredential('user@test.com', 'pass').then(role => {
    expect(role).toBe('tecnico');
  });
});

// Pattern 3: Mock promise resolution
it('awaits async calls', async () => {
  mockInsertValues.mockResolvedValue(undefined);
  await insertTree({ ... });
  expect(mockInsertValues).toHaveBeenCalled();
});
```

**Error Testing:**
```typescript
// Pattern 1: Expecting thrown errors
it('throws on duplicate', async () => {
  mockSelectResults = [{ maxPos: null }];
  mockInsertValues.mockRejectedValue(new Error('Duplicate key'));
  
  await expect(insertTree({ ... })).rejects.toThrow('Duplicate key');
});

// Pattern 2: Checking error handling (non-throwing)
it('handles network error gracefully', async () => {
  mockDb.select.mockRejectedValue(new Error('Network'));
  
  const result = await pullSpeciesFromServer();
  expect(result).toBeUndefined(); // Non-fatal, returns void
});

// Pattern 3: Error code inspection
it('maps Supabase error code to sync error', async () => {
  const { error: syncError } = await uploadOfflinePlantations();
  expect(syncError.code).toBe('23505'); // Duplicate key
});
```

**Transaction Testing:**
```typescript
it('runs in a transaction (all updates or none)', async () => {
  mockSelectResults = [
    { id: 'tree-1', posicion: 1, ... },
    { id: 'tree-2', posicion: 2, ... },
  ];

  await reverseTreeOrder('sg-1', 'L1');

  // Verify transaction was invoked
  expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  
  // Verify all updates were called
  expect(mockUpdateWhere).toHaveBeenCalledTimes(2);
});
```

**Mock State Reset Pattern:**
```typescript
beforeAll(() => {
  mockDb = createMockDb(); // Create once
});

beforeEach(() => {
  jest.clearAllMocks(); // Clear mock call history
  mockSelectResults = []; // Reset data
  mockDb.select.mockClear(); // Clear implementation
});

afterEach(() => {
  // Optional cleanup if needed
});
```

## Test Execution

**Running Tests:**

```bash
# Unit tests only (no integration)
npm test

# Unit tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- TreeRepository.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="insertTree"

# Run integration tests
npm test -- jest.integration

# Full coverage report
npm test -- --coverage

# Run with verbose output
npm test -- --verbose
```

**Test Output Example:**
```
PASS  tests/database/tree.test.ts
  TreeRepository
    insertTree
      ✓ first tree in subgroup gets posicion=1 (TREE-03) (12ms)
      ✓ inserts tree with auto-incremented position (TREE-02, TREE-03) (8ms)
      ✓ generates correct subId (TREE-04) (5ms)
    deleteLastTree
      ✓ deletes only the last tree by posicion (TREE-07) (7ms)

Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
Snapshots:   0 total
Time:        1.234s
```

## Notes on Test Data

- **UUID Generation:** Mocked to return predictable strings: `test-uuid-abc123`
- **Dates:** Tests use `localNow()` from `dateUtils.ts` (tested separately)
- **Hashing:** Mocked to return `mock-hash-{input}` for deterministic crypto tests
- **Random Bytes:** Mocked to return `Uint8Array(n).fill(42)` for consistent values

---

*Testing analysis: 2026-04-12*
