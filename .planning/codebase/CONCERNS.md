# Codebase Concerns

**Analysis Date:** 2026-04-12

## Dead Code

**Unused Hook Export:**
- Issue: `useSubGroupsForPlantation()` exported from `src/hooks/useSubGroups.ts` but never imported or used anywhere in the codebase
- Files: `src/hooks/useSubGroups.ts`
- Impact: Dead code increases maintenance burden and cognitive load. The function is exported but unreferenced.
- Fix approach: Search all test files and app code for any references; if none found, delete the file. If needed elsewhere, extract to queries or create a proper integration point.
- Search result: Zero references in src/ or tests/

**Unused Hook Definition:**
- Issue: `useConfirm()` in `src/hooks/useConfirm.ts` is defined but only referenced in its own file (2 references, both in the same file)
- Files: `src/hooks/useConfirm.ts`
- Impact: This appears to be a utility hook that may have been planned but not integrated into the component tree
- Fix approach: Verify if this is intentionally unused or if it should be imported in modal/confirmation flows

---

## Duplicated Code

**Admin/Tecnico Thin Wrappers (GOOD PATTERN):**
- Good news: Route wrapper files in `app/(admin)/` and `app/(tecnico)/` are thin and correctly delegate to shared screens
- Examples:
  - `app/(admin)/perfil.tsx` and `app/(tecnico)/perfil.tsx` → both import `PerfilScreen` with role parameter
  - `app/(admin)/plantaciones.tsx` and `app/(tecnico)/plantaciones.tsx` → both import `PlantacionesScreen`
- Status: Follows correct centralization pattern. No consolidation needed.

**Plantation Functions with Offline Variants:**
- Pattern: Functions exist in pairs for "online" and "Locally" variants
- Examples in `src/repositories/PlantationRepository.ts`:
  - `createPlantation()` (server) / `createPlantationLocally()` (offline)
  - `saveSpeciesConfig()` (server) / `saveSpeciesConfigLocally()` (offline)
- Files: `src/repositories/PlantationRepository.ts` (431 lines), `src/repositories/SubGroupRepository.ts` (312 lines)
- Impact: Moderate code duplication (~15-20% of file size). Functions share similar validation but differ in sync strategy.
- Fix approach: Extract common validation logic to shared helper functions. Consider a generic `persistData()` wrapper that handles both paths.
- Current mitigation: Comments explain the different patterns (good); logic separation is intentional per offline-first architecture

**Similar Modal/Form Components:**
- Pattern: Multiple form modals share similar structure but with role-specific actions
- Examples: `PlantationFormModal.tsx` (228 lines), `PlantationConfigCard.tsx` (286 lines), `SubgrupoForm.tsx` (182 lines)
- Files: `src/components/PlantationFormModal.tsx`, `src/components/SubgrupoForm.tsx`, `src/components/PlantationConfigCard.tsx`
- Impact: Input validation, error handling, and loading state logic are repeated across modals
- Fix approach: Extract base modal component with common patterns (validation, error state, loading spinner) and parametrize label/fields

**Photo Sync Logic:**
- Pattern: Photo syncing appears in multiple places
- Files: `src/services/SyncService.ts` (758 lines), `src/repositories/TreeRepository.ts` (216 lines)
- Impact: Tree photo upload logic (`uploadPhotoToStorage`) and tree photo syncing (`markPhotoSynced`) are coordinated across files
- Current state: Well-separated (service vs. repository), but download/upload/marking logic could be more atomic

---

## Unused Dependencies

**react-dom:**
- Dependency: `"react-dom": "^19.2.4"` in `mobile/package.json`
- Issue: React DOM is for web; this is a React Native app (Expo)
- Impact: Increases bundle size unnecessarily (though probably dead-stripped by Metro bundler)
- Fix approach: Remove from `mobile/package.json` dependencies

**scheduler:**
- Dependency: `"scheduler": "^0.27.0"` in `mobile/package.json`
- Issue: This is a peer dependency of React, not explicitly used
- Impact: May be required by Expo's internal React usage; removing could break builds
- Fix approach: Verify with `npm list scheduler` before removing; likely safe to remove if not explicitly imported

---

## Test Coverage Gaps

**SyncService - Complex Logic Undertested:**
- What's not tested: Comprehensive error recovery scenarios during photo downloads; multi-plantation sync failure handling
- Files: `src/services/SyncService.ts` (758 lines) has test coverage via `tests/sync/SyncService.test.ts` and `SyncService.offline.test.ts`
- Risk: Photo sync workflow (lines 668-758) involves external Storage calls and file operations that are hard to mock
- Priority: Medium - Most critical paths are covered; edge cases in photo handling need attention

**PlantationRepository.ts - Offline Edit Logic:**
- What's not tested: Edge cases in pendingEdit snapshot logic (lines 185-195); discardEdit on partially-synced plantations
- Files: `src/repositories/PlantationRepository.ts` (431 lines)
- Risk: Discard edit logic depends on tracking `lugarServer`/`periodoServer` correctly; wrong state could lose user work
- Recommendation: Add test for "edit plantation offline, then network comes back, user discards" scenario

**Hook Integration Tests:**
- What's not tested: Interaction between `useAuth`, `useSync`, and `usePlantaciones` during role changes or re-auth
- Files: `src/hooks/useAuth.ts` (275 lines), `src/hooks/useSync.ts` (missing test file), `src/hooks/usePlantaciones.ts` (156 lines)
- Risk: State inconsistencies could occur if one hook re-initializes while another is pending
- Priority: High - Multi-hook coordination is error-prone

---

## Large/Complex Files

**SyncService.ts (758 lines):**
- Complexity: Handles pull, push, photo download, photo upload, batch operations
- Risk: Hard to test individual operations; mixing async coordination with photo file ops
- Recommendation: Split into:
  - `PhotoSyncService` — upload/download/mark photo synced
  - `PullService` — pull from Supabase
  - `PushService` — push pending changes
  - `SyncOrchestrator` — coordinates the three

**usePlantationAdmin.ts (269 lines):**
- Complexity: Manages modal states, finalize logic, ID generation, deletion
- Risk: Multiple side effects and state transitions; hard to test modal interaction
- Recommendation: Extract modal-specific state to separate `usePlantationAdminModals` hook

**AdminBottomSheet.tsx (360 lines):**
- Complexity: Estado-aware rendering of 6+ action items with conditional UI
- Risk: Easy to introduce regressions when adding new actions
- Recommendation: Extract `ActionItem` into separate list config; use data-driven approach instead of nested if/else

**AdminPlantationModals.tsx (268 lines):**
- Complexity: Manages create, config species, assign technicians modals
- Risk: Modal show/hide logic is tightly coupled to parent state
- Recommendation: Move modal definitions to data structure; use modal context for cleaner orchestration

---

## Performance Bottlenecks

**Photo Download During Catalog Pull:**
- Problem: `downloadPhotosForPlantation()` in SyncService (lines 668-714) is non-blocking but sequential per tree
- Files: `src/services/SyncService.ts`
- Cause: Photos download one-by-one after plantation data is pulled; no parallelization
- Current impact: If a plantation has 100+ trees with photos, UI can freeze during download
- Improvement path: Use `Promise.all()` with configurable concurrency limits (e.g., 5 simultaneous downloads). Add cancellation token support.

**FlatList Rendering Without Memoization:**
- Problem: PlantationCard in PlantacionesScreen re-renders all items on any state change
- Files: `src/screens/PlantacionesScreen.tsx` (231 lines)
- Cause: Filter changes trigger full list re-render
- Impact: 50+ plantations in a single organization could cause lag
- Improvement path: Wrap PlantationCard in `React.memo()` and use stable key prop; add `useMemo()` for filtered list

**Synchronous Tree Deletion:**
- Problem: `deleteTreeAndRecalculate()` in TreeRepository recalculates ALL preceding trees' order sequentially
- Files: `src/repositories/TreeRepository.ts` (lines 182-215)
- Cause: SQL updates are one per tree (no batch operation)
- Impact: Deleting a tree from a 50-tree subgroup takes ~50 UPDATE queries
- Improvement path: Use Drizzle batch update or raw SQL update with CASE statements

---

## Fragile Areas

**Offline-First State Machine (Medium Risk):**
- Files: `src/repositories/PlantationRepository.ts`, `src/repositories/SubGroupRepository.ts`, `src/services/SyncService.ts`
- Why fragile: Multiple places track `pendingSync`, `pendingEdit`, `lugarServer`, `periodoServer`. Forgetting to update any field breaks sync.
- Examples:
  - Line 123-128 in PlantationRepository: Must check `pendingSync` AND `createdAt` to determine if offline-created
  - Line 159-195: Server snapshot columns must stay in sync during edit lifecycle
- Safe modification: Before touching any offline state field, trace through all 3 files to ensure consistency
- Test coverage: Gaps in discard-edit and re-edit scenarios

**LiveQuery Subscription Cleanup (Low Risk):**
- Files: `src/database/liveQuery.ts` (31 lines)
- Why fragile: Multiple hooks subscribe to the same live query; one component unmounting shouldn't unsubscribe others
- Current state: Uses `useLiveData` hook which manages subscription via ref count; appears safe but not explicitly documented
- Safe modification: Add explicit tests for multiple subscribers to ensure cleanup is correct

**Photo URI Handling Across Sync:**
- Files: `src/repositories/TreeRepository.ts`, `src/services/SyncService.ts`, components
- Why fragile: Trees can have `file://` URIs (local) or `https://` URIs (remote). Logic that mixes them can break.
- Risk: Line 709 in SyncService downloads to local filesystem; if called twice, could overwrite local edits with server copy
- Safe modification: Use strict URI type checking (`isLocalUri()` / `isRemoteUri()`) before any operation; add tests for URI transitions

**Role-Based Access Control (RBAC) in Queries:**
- Files: `src/queries/adminQueries.ts`, `src/queries/catalogQueries.ts`, multiple repositories
- Why fragile: Some queries filter by `userId` for tecnico, but admin should see all; easy to copy-paste wrong filter
- Example: `getSyncableSubGroups()` in SubGroupRepository takes optional `userId` parameter; passing wrong value leaks data
- Safe modification: Create role-aware query wrapper that injects userId automatically based on auth context

---

## Scaling Limits

**Local SQLite Database Growth:**
- Current capacity: No explicit limit enforced
- Limit: SQLite can handle millions of rows, but random-access on unindexed columns gets slow ~100k rows
- Scaling path:
  - Add indexes on `plantacionId`, `subgrupoId` in trees table (high cardinality queries)
  - Implement soft-delete + periodic cleanup for finalized plantations
  - Consider data archival after plantation finalization

**Photo Storage on Device:**
- Current capacity: Photos cached in `Paths.cache` without size limit
- Limit: Device storage varies; large organizations could hit 1GB+ with 1000+ tree photos at high resolution
- Scaling path:
  - Implement cache eviction (LRU based on access time)
  - Add option to clear photos after sync completes
  - Resize photos on capture to max 5MP (see `src/services/PhotoService.ts`)

**In-Memory Sync State:**
- Current capacity: All pending subgroups held in memory during sync
- Limit: 1000+ pending subgroups could cause memory pressure
- Scaling path:
  - Paginate sync uploads (e.g., 50 at a time)
  - Store progress in SQLite so resume works across app restarts
  - Current: `batchDownload()` in SyncService already paginated (line 727-758); push needs same treatment

**User/Organization Limit:**
- Current capacity: No client-side limit
- Assumption: Each organization has <500 technicians; each user manages <100 plantations
- Scaling path: If violated, add:
  - Pagination to technician selection screens
  - Offline plantation filtering (load only recent/active)
  - Server-side data aggregation for large organizations

---

## Dependencies at Risk

**expo (^54.0.0):**
- Risk: Major version; yearly release cycle means API breakage possible
- Impact: Navigation, file system, image manipulation APIs could change
- Migration plan: Monitor Expo release notes; lock to `~54.0.0` to avoid accidental upgrades

**@react-native-community/netinfo (11.4.1):**
- Risk: Returns unreliable connection state; known issue on some devices
- Current mitigation: Logic treats `isOnline=false` conservatively (doesn't assume online); see `src/hooks/useNetStatus.ts`
- Migration plan: If reliability issues appear, consider own polling via HTTP HEAD requests

**drizzle-orm (^0.45.1):**
- Risk: SQLite dialect still beta; breaking changes possible in minor versions
- Impact: Type safety and migrations could break
- Migration plan: Lock to `~0.45.1` until v1.0 release; test thoroughly before upgrades

**@supabase/supabase-js (^2.99.2):**
- Risk: Pre-3.0; last minor version before major release
- Impact: Likely 3.0 coming soon with breaking changes
- Migration plan: Plan upgrade to 3.0 soon; check breaking changes in release notes

---

## Security Considerations

**Environment Variables Handling:**
- Risk: Supabase keys in `.env` not committed; but eas.json uses env block per feedback notes
- Files: `mobile/.env`, `eas.json`
- Current mitigation: Keys stored in `eas.json` env block; local builds use `dotenv`
- Recommendation: Document that remote EAS builds are disabled (per user memory); only local builds should happen

**Auth Token Persistence:**
- Risk: Tokens stored in Expo SecureStore (TEE on Android/iOS), but could be compromised on jailbroken devices
- Files: `src/supabase/auth.ts` (lines 4-8)
- Current mitigation: ACCESS_TOKEN and REFRESH_TOKEN split to stay under 2048-byte limit (Pitfall 4)
- Recommendation: Rotate refresh tokens aggressively (consider 1-hour expiry); implement token revocation on logout

**SQL Injection (Low Risk):**
- Risk: All queries use Drizzle ORM with parameterized inputs; no raw SQL in repositories
- Files: All `src/repositories/*.ts`, `src/queries/*.ts`
- Status: Safe - ORM prevents injection

**Role-Based Access Control (Medium Risk):**
- Risk: Tecnico vs Admin filtering happens client-side; server-side validation needed
- Files: Queries check role in `useAuth()` and filter UI accordingly
- Recommendation: Never trust client role filtering; server must validate user's organization before returning data

---

## Missing Critical Features

**User Permissions Audit Log:**
- Problem: No audit trail for who created/edited/deleted plantations
- Blocks: Compliance audits; identifying accidental deletions
- Impact: Moderate - can be added as post-phase feature

**Notification System:**
- Problem: No in-app notifications for sync errors or data conflicts
- Blocks: Users unaware of sync failures until they try to access data
- Impact: Medium - currently handled via error alerts, but no persistent notification

**Data Conflict Resolution:**
- Problem: If two technicians edit the same subgroup offline, last-write-wins (no merge)
- Blocks: Collaborative editing
- Impact: Low - current workflow assumes offline work on different subgroups

**Batch Photo Operations:**
- Problem: Can't bulk-download photos for multiple plantations
- Blocks: Offline preparation for fieldwork
- Impact: Low - workaround is download each plantation individually

---

## Architecture Concerns

**Database Schema Migration Risk:**
- Files: `mobile/src/database/schema.ts`, `mobile/drizzle/migrations/`
- Issue: Drizzle migrations track in 3 places: SQL file, journal, migrations.js (per user memory `feedback_drizzle_migrations.md`)
- Risk: If migrations.js is missing, splash screen hangs during schema initialization
- Mitigation: Automated test should verify all 3 files sync before build

**LiveQuery Subscription Pattern:**
- Files: `src/database/liveQuery.ts`, multiple hooks using `useLiveData`
- Issue: Silent error handling (line 31: `.catch(console.error)`) means stale data if subscription fails
- Risk: UI shows outdated data without user awareness
- Recommendation: Emit error state through context; show "data is stale" indicator

**Offline State Recovery:**
- Files: `src/hooks/useAuth.ts`, `src/services/OfflineAuthService.ts`
- Issue: If app crashes during sync, recovery is implicit (next sync retries)
- Risk: User unaware of partial sync state
- Recommendation: Implement explicit recovery prompt on app restart if `pendingSync=true` exists

---

## Code Quality Issues

**Console Logging in Production:**
- Instances: 41 total across codebase (mostly in services, hooks)
- Examples: `console.error` in SyncService (12 instances), `console.log` in Supabase client
- Risk: Performance impact on low-end devices; exposes internal logic
- Recommendation: Replace with structured logging service (e.g., Sentry or custom logger) in production

**Magic Numbers Without Constants:**
- Examples:
  - `2048` byte limit for SecureStore (documented in comment; good)
  - Photo resize dimensions (likely hardcoded in PhotoService)
  - Sync batch size (not found; assume sequential)
- Recommendation: Extract to `src/config/constants.ts`

**Import Organization Inconsistency:**
- Pattern: Some files group by type, others by source; no consistent barrel re-exports for components
- Files: `src/components/`, `src/hooks/`
- Impact: Verbose imports; hard to track public API
- Recommendation: Add `src/components/index.ts` and `src/hooks/index.ts` with named exports

**Missing TypeScript Strict Mode:**
- Risk: `any` types could hide bugs
- Recommendation: Enable `strict: true` in `tsconfig.json`; fix type errors incrementally

---

## Summary of Action Items

| Area | Priority | Effort | Impact |
|------|----------|--------|--------|
| Remove unused `useSubGroups.ts` hook | Low | 15m | Reduces clutter |
| Remove `react-dom` dependency | Low | 5m | Smaller bundle |
| Split SyncService into 3 focused services | High | 4h | Better testability, fewer bugs |
| Add memoization to PlantationCard | Medium | 1h | Fixes list performance at 50+ items |
| Extract form validation to utility | Medium | 2h | Reduces duplication, easier testing |
| Add RBAC wrapper for queries | High | 2h | Prevents accidental data leaks |
| Lock dependency versions (expo, drizzle) | Medium | 30m | Prevents breaking upgrades |
| Implement structured logging | Medium | 2h | Production-ready debugging |

---

*Concerns audit: 2026-04-12*
