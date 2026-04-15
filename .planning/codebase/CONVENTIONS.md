# Coding Conventions

**Analysis Date:** 2026-04-12

## Naming Patterns

**Files:**
- PascalCase for component files: `PlantationCard.tsx`, `TreeRowItem.tsx`, `ConfirmModal.tsx`
- camelCase for utility/hook files: `useAuth.ts`, `idGenerator.ts`, `dateUtils.ts`, `alertHelpers.ts`
- PascalCase for repository classes: `TreeRepository.ts`, `PlantationRepository.ts`, `SubGroupRepository.ts`
- camelCase for service files: `SyncService.ts`, `OfflineAuthService.ts`
- Styles files follow source convention: `TreeRegistrationScreen.styles.ts`

**Functions:**
- camelCase for all exported functions: `insertTree()`, `deleteLastTree()`, `generateSubId()`, `useLiveData()`
- camelCase for event handlers: `onPress()`, `onDelete()`, `onAttachPhoto()`
- Prefix hook functions with `use`: `useAuth()`, `usePlantaciones()`, `useSubGroups()`
- Spanish naming for domain-specific logic: `estado`, `especieId`, `subgrupoCodigo`, `usuarioRegistro`, `fotoUrl`, `fotoSynced`

**Variables:**
- camelCase for all state and local variables
- Spanish for domain state names: `activa`, `finalizada`, `sincronizada`, `pendingSync`, `pendingEdit`
- Prefix mocks in tests with `mock`: `mockSelectResults`, `mockInsertValues`, `mockDb`
- Prefix test fixtures with descriptive names: `allTrees`, `maxResult`, `localPs`

**Types:**
- PascalCase for all TypeScript interfaces and types: `InsertTreeParams`, `SyncProgress`, `SubGroupEstado`, `TreeItemData`
- Type imports use explicit `type` keyword: `import type { TreeItemData } from './TreeRowItem'`
- Props types for components named `Props`: `type Props = { ... }`

**Colors & Theme:**
- All semantic colors stored in `src/theme.ts` — NEVER hardcode color values in components
- Access via destructuring: `const { colors, fontSize, spacing, borderRadius, fonts } = require('../theme')`
- Spanish state color values: `colors.stateActiva`, `colors.stateFinalizada`, `colors.stateSincronizada`
- Semantic stat colors: `colors.statTotal`, `colors.statSynced`, `colors.statToday`, `colors.statPending`

## Code Style

**Formatting:**
- ESLint configured with `eslint-config-expo` flat config
- Config file: `mobile/eslint.config.js`
- Expo's linting preset enforces most conventions automatically

**Linting:**
- Run: `npm run lint` (at mobile/ root)
- No strict prettier config — relies on ESLint configuration
- Avoid inline styling: all styles use `StyleSheet.create()` in same file or theme

**Import Organization:**
- Group 1: React and React Native imports
- Group 2: Expo and third-party libraries
- Group 3: Internal absolute imports (`src/...`)
- Group 4: Local relative imports (`./...`)

**Example:**
```typescript
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing } from '../theme';
import { useAuth } from '../hooks/useAuth';
import TreeRowItem from './TreeRowItem';
```

**Path Aliases:**
- No path aliases configured — all imports use relative or absolute paths from `src/`
- Absolute imports from `src/` preferred over `../../` chains in deeply nested files

## Error Handling

**Patterns:**
- Non-blocking errors (e.g., Supabase catalog pull) use early return: `if (error || !data) return;`
- Network errors caught and logged with descriptive tags: `console.error('[Sync] Upload failed:', id, message)`
- Error code enums provide semantic meaning: `SyncErrorCode = 'DUPLICATE_CODE' | 'NETWORK' | 'UNKNOWN'`
- User-facing errors mapped to Spanish messages via `ERROR_MESSAGES` constant
- Database mutations may throw; calling code must handle or let errors propagate up

**Drizzle ORM Error Codes:**
- Code `23505` = duplicate key constraint (handled gracefully for idempotent operations)
- Caught at service layer, logged, and skipped without crashing sync pipeline

## Logging

**Framework:** `console` (no logger abstraction)

**Patterns:**
- Tag logs with module name in brackets: `[Auth]`, `[Sync]`, `[Freshness]`, `[Admin]`
- Use `console.error()` for errors that should be reported
- Use `console.warn()` for conditions that may be expected (e.g., offline state, unconfigured Supabase)
- Use `console.log()` for operational success (e.g., plantation deletion count)
- Catch-all error handlers in hooks: `.catch(console.error)` only when error recovery isn't needed

**Examples:**
```typescript
console.error('[Sync] Upload plantation failed:', plantId, plantError.message);
console.warn('[Auth] Supabase not configured — skipping auth init');
console.log('[Admin] Deleted 5 plantation_users for plantation-123 OK');
```

## Comments

**When to Comment:**
- Document non-obvious algorithmic logic: position reversal formula, ID generation rules
- Mark CRITICAL sections that prevent common pitfalls: "CRITICAL: Always query MAX from DB — never trust React state"
- Document feature specs referenced in code: "OFPL-04", "TREE-03", "NN-01" map to requirements
- Add JSDoc for public function signatures (repositories, services, hooks)

**JSDoc/TSDoc:**
- Used for exported functions in repositories and services
- Format: `/** comment */ export function name(params)` — single-line or multi-line as needed
- Include feature code references: `* OFPL-04` or `* Covers: TREE-02, TREE-03`
- Example:
```typescript
/**
 * Inserts a tree at the next position in subgroup.
 * CRITICAL: Always query MAX from DB — never trust React state (Pitfall 2)
 * Covers: TREE-02, TREE-03, TREE-04
 */
export async function insertTree(params: InsertTreeParams): Promise<InsertTreeResult> {
```

## Function Design

**Size:**
- Refactor functions over 20 lines (where logic is extractable)
- Service functions (`SyncService`) may exceed 20 lines for complex workflows; break into internal helpers
- Repository functions typically stay <30 lines
- Components refactor large JSX into sub-components at reasonable boundaries

**Parameters:**
- Use object parameters for >2 params: `function insertTree(params: InsertTreeParams)`
- Define interface for object params to enable reuse: `export interface InsertTreeParams { ... }`
- Components accept `Props` interface with all required and optional fields

**Return Values:**
- Repositories return domain types: `InsertTreeResult`, `SubGroup`, arrays of entities
- Services return semantic results: `SyncProgress`, `{ success: true } | { success: false; error }`
- Hooks return data with refetch/mutation functions: `{ data, loading, error, refetch }`
- Utility functions return primitive or domain types (never void)

## Module Design

**Exports:**
- Repositories export functions (not class methods): `export async function insertTree(...)`
- Services export stateless functions: `export async function uploadOfflinePlantations()`
- Hooks export both hook function and supporting utilities: `export function useAuth()` + `export const USER_ID_KEY`
- Components export default function only (types exported as needed for consumers)

**Barrel Files:**
- Not used — direct imports from source file preferred
- Avoid re-exports that obscure origin file

**Repository Pattern:**
- All database writes go through repositories in `src/repositories/`
- All complex queries go through queries in `src/queries/` or repositories
- No raw `db.select()` calls in components or screens
- Repositories call `notifyDataChanged()` after mutations to trigger live data updates

---

## Dead Code & Duplication Issues

**Identified Dead Code:**

1. **`TreeRow.tsx` (UNUSED COMPONENT)**
   - File: `src/components/TreeRow.tsx` (77 lines)
   - Status: Never imported or rendered anywhere
   - Replaced by: `TreeRowItem.tsx` which is actively used in `ReadOnlyTreeView.tsx` and `TreeListModal.tsx`
   - Action: **DELETE** — this is duplicate of `TreeRowItem` with identical props/behavior
   - Impact: Low — not breaking anything, but adds maintenance burden

2. **Route File Duplication (MINIMAL BUT PRESENT)**
   - Files: `app/(admin)/plantaciones.tsx` and `app/(tecnico)/plantaciones.tsx`
   - Both files: `import PlantacionesScreen from '../../src/screens/PlantacionesScreen'; export default PlantacionesScreen;`
   - Pattern: This is EXPECTED in Next.js/Expo Router for role-based navigation. **CORRECT** — not a code smell.
   - All shared screens correctly reside in `src/screens/` and `src/components/`

**Identified Duplication (Code Reuse — GOOD):**

1. **Styling Duplication (ACCEPTABLE)**
   - 46 `StyleSheet.create()` calls across 46 components
   - Pattern: Styles are co-located with components (proper React convention)
   - Color values ALL pulled from centralized `theme.ts` — **ZERO hardcoded colors**
   - Impact: Acceptable. Change one color in `theme.ts` → updates 50+ components instantly

2. **Test Setup Duplication (MINIMAL & NECESSARY)**
   - Files: `tests/setup.ts` and `tests/setup.integration.ts`
   - Difference: Integration tests use real SQLite (better-sqlite3), not mocked
   - Both mock: `@react-native-async-storage/async-storage`, `expo-secure-store`, `expo-crypto`
   - Duplication is **INTENTIONAL** — integration tests have different requirements
   - No refactoring needed — jest doesn't support conditional mocking easily

3. **Mock Database Pattern Repeated (CORRECT PATTERN)**
   - Files: `tests/database/tree.test.ts`, `tests/database/subgroup.test.ts`, `tests/admin/PlantationRepository.test.ts`
   - Each defines `mockDb` with consistent Drizzle-ORM chain structure
   - Duplication is **NECESSARY** — each test suite needs isolated mock state
   - Could extract to shared fixture, but would add indirection without major benefit (mocks are simple)

**Potential Refactoring Opportunities:**

1. **Mock Setup Fixture (OPTIONAL ENHANCEMENT)**
   - Current: Each test file independently creates mock database
   - Improvement: Extract `createMockDb()` helper to `tests/__mocks__/mockDatabase.ts`
   - Impact: Reduces duplication in 8+ test files, centralizes mock behavior
   - Priority: LOW — not blocking, minor code smell only

2. **Error Message Centralization (ALREADY DONE)**
   - All sync error messages in `SyncService.ts`: `ERROR_MESSAGES` constant
   - Spanish state chips already centralized: `colors.stateActiva`, `colors.stateFinalizada`, `colors.stateSincronizada`
   - **Well done** — no duplication of error strings

3. **Console.error Tags (CONSISTENT)**
   - All console logs tagged with module: `[Auth]`, `[Sync]`, `[Freshness]`, `[Admin]`
   - Could extract to logging helper function, but overhead not justified
   - Current approach is transparent and maintainable

**Unused Imports/Variables:**

- Scan shows NO unused imports detected in production code
- Test files properly import all mocked dependencies
- All exported functions from `repositories/`, `queries/`, `services/`, `hooks/` are consumed

**Summary:**

- **Critical Issues:** None (TreeRow.tsx is dead but isolated)
- **Code Duplication:** Minimal and mostly intentional (test setup, styling per-component)
- **Architecture Adherence:** EXCELLENT — theme centralized, zero hardcoded styles, repositories segregated, no queries in screens
- **Maintenance Burden:** Low — codebase follows rules consistently

---

*Convention analysis: 2026-04-12*
