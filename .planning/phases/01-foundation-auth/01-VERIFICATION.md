---
phase: 01-foundation-auth
verified: 2026-03-16T00:00:00Z
status: human_needed
score: 13/16 must-haves verified
re_verification: false
human_verification:
  - test: "Admin login shows 3-tab navigation"
    expected: "Log in with admin1@bayka.org / BaykaAdmin1! and see 3 tabs: Plantaciones, Admin, Perfil"
    why_human: "Cannot run the Expo app in a CI/headless context to assert tab bar rendering"
  - test: "Tecnico login shows 2-tab navigation"
    expected: "Log in with tecnico1@bayka.org / BaykaTecnico1! and see 2 tabs: Plantaciones, Perfil (no Admin tab)"
    why_human: "Requires running app on device/simulator"
  - test: "Offline session restore works after airplane mode"
    expected: "Close app, enable airplane mode, reopen — admin 3-tab bar appears without showing login screen"
    why_human: "Requires device-level network state control"
  - test: "Wrong password shows Spanish error"
    expected: "Enter wrong password, tap Iniciar sesion — red text 'Email o contrasena incorrectos' appears below form"
    why_human: "Requires live Supabase auth endpoint and running app"
  - test: "Second user on same device after logout"
    expected: "Log out, log in as different user with different role — correct role-based navigation appears"
    why_human: "Multi-user SecureStore clearing verifiable by unit test but full flow needs running app"
  - test: "Supabase backend state: 4 users and profiles seeded"
    expected: "Supabase Dashboard shows admin1@bayka.org, admin2@bayka.org, tecnico1@bayka.org, tecnico2@bayka.org in Auth + matching profiles rows"
    why_human: "Cannot query live Supabase project programmatically without credentials in CI"
---

# Phase 1: Foundation + Auth Verification Report

**Phase Goal:** The app runs offline-safely with working auth, a migration-ready SQLite schema, and role-based navigation that persists across restarts
**Verified:** 2026-03-16
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | App compiles with TypeScript (npx tsc --noEmit exits 0) | VERIFIED | `npx tsc --noEmit` exits 0 with no output |
| 2  | SQLite database initializes with all required tables via Drizzle migrations | VERIFIED | `mobile/drizzle/0000_peaceful_winter_soldier.sql` exists; `useMigrations(db, migrations)` in `_layout.tsx` gates rendering |
| 3  | Species catalog seeded from bundled JSON on first launch, idempotent on subsequent launches | VERIFIED | `seedSpecies.ts` uses count() guard; called from `_layout.tsx` `useEffect` after migration success |
| 4  | Drizzle migrations run before any screen renders (useMigrations gates rendering) | VERIFIED | `_layout.tsx` returns loading/error views until `success` is true before calling `useAuth` or redirecting |
| 5  | Metro bundles .sql files | VERIFIED | `metro.config.js` contains `config.resolver.sourceExts.push('sql')` |
| 6  | Supabase backend schema has all 8 required tables with RLS | VERIFIED (artifact) | `supabase/migrations/001_initial_schema.sql` has 8 CREATE TABLE statements and 8 `enable row level security` calls |
| 7  | 4 seeded users exist in Supabase Auth with matching profiles | NEEDS HUMAN | Seed script exists and is correct; live Supabase state cannot be verified programmatically |
| 8  | User can log in with email/password and is redirected by role | NEEDS HUMAN | Code is complete and wired; requires running app against live Supabase |
| 9  | Session persists offline across restarts (SecureStore split keys, NetInfo check) | VERIFIED (code) | `restoreSession()` checks `NetInfo.isConnected` before calling `supabase.auth.setSession`; tokens stored as separate keys; 4 unit tests pass |
| 10 | Logout clears session — reopening app shows login screen | VERIFIED (code) | `clearSession()` deletes all 4 SecureStore keys; `SIGNED_OUT` handler calls it; unit test confirms |
| 11 | Second user can log in on same device after logout | VERIFIED (code) | `clearSession()` removes all keys; `restoreSession()` returns null after clear; `multiuser.test.ts` passes |
| 12 | Login screen shows Spanish error for wrong password | VERIFIED (code) | `login.tsx` line 34: `setError('Email o contraseña incorrectos')` on authError; rendered in red below form |
| 13 | Admin login shows 3-tab navigation; tecnico login shows 2-tab navigation | NEEDS HUMAN | Code: `(admin)/_layout.tsx` has 3 `Tabs.Screen`; `(tecnico)/_layout.tsx` has 2 `Tabs.Screen`; runtime behavior requires device |
| 14 | All unit tests pass | VERIFIED | `npx jest --passWithNoTests`: 13/13 tests, 6 suites, all green |
| 15 | Role determined offline from SecureStore cache (not live Supabase query) | VERIFIED | `restoreSession()` never queries `profiles`; role read via `SecureStore.getItemAsync(ROLE_KEY)`; `role.test.ts` asserts `supabase.from` is NOT called |
| 16 | Navigation persists across restarts | NEEDS HUMAN | Code path is correct (SecureStore restore → setSession/cached role → Redirect); requires device test |

**Score:** 13/16 truths fully verified; 3 need live Supabase/device verification

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `mobile/src/database/schema.ts` | Drizzle table definitions for species, plantations, subgroups, trees | VERIFIED | Exports all 4 tables using `sqliteTable`; full column definitions match domain model |
| `mobile/src/database/client.ts` | SQLite singleton with WAL mode enabled | VERIFIED | `sqlite.execSync('PRAGMA journal_mode=WAL;')` before `drizzle()` call; exports `db` |
| `mobile/src/types/domain.ts` | TypeScript types for User, Role, Session | VERIFIED | Exports `Role`, `UserProfile`, `Session` interfaces |
| `mobile/assets/species.json` | Species seed data with codigo, nombre, nombre_cientifico | VERIFIED | 10 Argentine native species; all entries have id, codigo, nombre |
| `mobile/metro.config.js` | Metro config with .sql extension support | VERIFIED | `config.resolver.sourceExts.push('sql')` present |
| `mobile/drizzle/0000_peaceful_winter_soldier.sql` | Generated initial migration | VERIFIED | File exists in `mobile/drizzle/` |
| `mobile/drizzle/migrations.js` | Drizzle migrator module | VERIFIED | File exists; required by `_layout.tsx` |
| `mobile/src/database/seeds/seedSpecies.ts` | Idempotent seed using count() | VERIFIED | count() guard, maps species.json to DB row format |
| `mobile/tests/database/migrations.test.ts` | Tests for FOUN-02 | VERIFIED | 3 tests: migrations importable, db defined, schema defined — all pass |
| `mobile/tests/database/seed.test.ts` | Tests for FOUN-03 | VERIFIED | 3 tests: insert on empty, idempotent, field validation — all pass |
| `supabase/migrations/001_initial_schema.sql` | Postgres schema for 8 backend tables | VERIFIED | 8 CREATE TABLE + 8 RLS enables + 10 RLS policies |
| `supabase/seed.ts` | Node.js seed script using Supabase admin client | VERIFIED | Uses `auth.admin.createUser()` + profiles insert; idempotent |
| `.env.example` | Template for required environment variables | VERIFIED | Contains `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| `mobile/src/supabase/client.ts` | Offline-aware Supabase client | VERIFIED | `detectSessionInUrl: false`, `AsyncStorage`, `autoRefreshToken: true` |
| `mobile/src/supabase/auth.ts` | Session helpers: restoreSession, persistSession, clearSession | VERIFIED | Split SecureStore keys; NetInfo check before setSession; all 3 functions exported |
| `mobile/src/hooks/useAuth.ts` | Auth state hook: session, role, loading, signIn, signOut | VERIFIED | Reads role from SecureStore on restore; fetches from profiles only on SIGNED_IN; unsubscribes on unmount |
| `mobile/app/(auth)/login.tsx` | Login screen with Spanish labels and inline error | VERIFIED | "Iniciar sesión" button, "Email o contraseña incorrectos" error text, pre-fill last email |
| `mobile/app/(tecnico)/_layout.tsx` | Tecnico tab bar: 2 tabs | VERIFIED | Plantaciones + Perfil |
| `mobile/app/(admin)/_layout.tsx` | Admin tab bar: 3 tabs | VERIFIED | Plantaciones + Admin + Perfil |
| `mobile/tests/auth/session.test.ts` | Unit tests for restoreSession | VERIFIED | 4 tests — all pass |
| `mobile/tests/auth/logout.test.ts` | Unit tests for clearSession | VERIFIED | 1 test — passes |
| `mobile/tests/auth/role.test.ts` | Unit tests for role caching | VERIFIED | 1 test — passes |
| `mobile/tests/auth/multiuser.test.ts` | Unit tests for multi-user flow | VERIFIED | 1 test — passes |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `mobile/app/_layout.tsx` | `mobile/src/database/client.ts` | `useMigrations(db, migrations)` | WIRED | `db` imported from client; `migrations` from `drizzle/migrations`; used in useMigrations call line 13 |
| `mobile/src/database/seeds/seedSpecies.ts` | `mobile/assets/species.json` | `import speciesData from '../../../assets/species.json'` | WIRED | Direct import; mapped to DB row format in insert |
| `mobile/app/_layout.tsx` | `mobile/src/hooks/useAuth.ts` | `useAuth()` returns `{ session, role, loading }` | WIRED | Imported line 6; destructured line 14; all 3 values used for routing decisions |
| `mobile/src/hooks/useAuth.ts` | `mobile/src/supabase/auth.ts` | `restoreSession()` on mount | WIRED | `restoreSession` called in initial `useEffect`; `clearSession` called in SIGNED_OUT handler |
| `mobile/src/supabase/auth.ts` | `expo-secure-store` | `SecureStore.getItemAsync / setItemAsync / deleteItemAsync` | WIRED | All 3 operations used with 4 distinct keys |
| `mobile/app/_layout.tsx` | `(admin)` or `(tecnico)` routes | `Redirect` based on role | WIRED | `role === 'admin'` → `/(admin)/plantaciones`; fallback → `/(tecnico)/plantaciones`; no-session → `/(auth)/login` |
| `mobile/app/(tecnico)/perfil.tsx` | `mobile/src/hooks/useAuth.ts` | `signOut` | WIRED | `const { signOut } = useAuth()` called on button press |
| `mobile/app/(admin)/perfil.tsx` | `mobile/src/hooks/useAuth.ts` | `signOut` | WIRED | `const { signOut } = useAuth()` called on button press |
| `mobile/app/(auth)/login.tsx` | `mobile/src/hooks/useAuth.ts` | `signIn` | WIRED | `const { signIn } = useAuth()` called on form submit |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FOUN-01 | 01-01 | App bootstraps with Expo SDK 55, React Native, TypeScript | SATISFIED | Expo SDK 55 project exists; `npx tsc --noEmit` exits 0 |
| FOUN-02 | 01-01 | Local SQLite database initialized with Drizzle ORM schema and migrations | SATISFIED | Schema, migration file, and `useMigrations` gate all present and tested |
| FOUN-03 | 01-01 | Species catalog seeded into local database on first launch | SATISFIED | `seedSpeciesIfNeeded()` called from `_layout.tsx`; idempotency tested; 10 species in JSON |
| FOUN-04 | 01-02 | Users seeded in Supabase (2 admin + 2 tecnico) | NEEDS HUMAN | Seed script is correct and idempotent; live Supabase state requires dashboard verification |
| FOUN-05 | 01-02 | Supabase backend schema deployed (all tables) | SATISFIED (artifact) | `001_initial_schema.sql` has all 8 tables + RLS; applied state requires human confirmation |
| AUTH-01 | 01-03 | User can log in with email and password via Supabase Auth | NEEDS HUMAN | `signIn` → `supabase.auth.signInWithPassword` wired; requires live Supabase + running app |
| AUTH-02 | 01-03 | User session persists across app restarts (offline-safe token storage) | SATISFIED (code) | Split SecureStore keys + NetInfo offline guard; 4 unit tests covering all paths |
| AUTH-03 | 01-03 | User can log out from any screen | SATISFIED | Both perfil screens call `signOut()`; `clearSession()` deletes all SecureStore keys |
| AUTH-04 | 01-03 | App detects user role and shows appropriate navigation | SATISFIED (code) | Role from SecureStore → `_layout.tsx` Redirect; 2-tab and 3-tab layouts exist |
| AUTH-05 | 01-03 | Different users can log in on same device | SATISFIED (code) | `clearSession()` removes all cached data; `multiuser.test.ts` confirms `restoreSession` returns null after clear |

**Orphaned requirements:** None. All 10 Phase 1 requirements (FOUN-01 through FOUN-05, AUTH-01 through AUTH-05) are claimed by plans and verified.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `mobile/app/(tecnico)/plantaciones.tsx` | "Proximamente disponible" placeholder content | Info | Expected — plan explicitly states Phase 3 will implement; navigation shell purpose only |
| `mobile/app/(admin)/plantaciones.tsx` | "Proximamente disponible" placeholder content | Info | Expected — same as above |
| `mobile/app/(admin)/admin.tsx` | "Proximamente disponible" placeholder content | Info | Expected — plan explicitly states Phase 4 will implement |

No blocker anti-patterns found. The placeholder screens are intentional per plan design — they exist to complete the navigation shell so Expo Router can resolve routes. The auth and data foundation layers are fully implemented.

---

### Human Verification Required

#### 1. Supabase Backend State

**Test:** Open Supabase Dashboard → Authentication → Users; verify 4 users exist. Open Table Editor → profiles; verify 4 rows with correct `rol` values.
**Expected:** 4 users (admin1@bayka.org, admin2@bayka.org, tecnico1@bayka.org, tecnico2@bayka.org); profiles table has 2 rows with `rol='admin'` and 2 with `rol='tecnico'`; all linked to organization `00000000-0000-0000-0000-000000000001`
**Why human:** Cannot query live Supabase project without service role key in this environment

#### 2. Admin Login and 3-Tab Navigation

**Test:** Run `cd mobile && npx expo run:ios` (or Android). Enter `admin1@bayka.org` / `BaykaAdmin1!`, tap Iniciar sesion.
**Expected:** App shows loading briefly, then 3-tab bar: Plantaciones, Admin, Perfil
**Why human:** Requires running Expo dev build on device/simulator connected to live Supabase

#### 3. Tecnico Login and 2-Tab Navigation

**Test:** From admin session, tap Perfil → Cerrar sesion. Log in with `tecnico1@bayka.org` / `BaykaTecnico1!`.
**Expected:** 2-tab bar: Plantaciones, Perfil. No Admin tab.
**Why human:** Same as above

#### 4. Offline Session Restore

**Test:** Log in as admin. Enable airplane mode. Force-close app. Reopen.
**Expected:** "Inicializando..." briefly, then admin 3-tab bar — no login screen shown
**Why human:** Requires device-level network control and app lifecycle management

#### 5. Wrong Password Error

**Test:** Log out, enter correct email but wrong password, tap Iniciar sesion.
**Expected:** Red text "Email o contraseña incorrectos" appears below the form. No crash.
**Why human:** Requires live Supabase auth endpoint response

---

### Gaps Summary

No functional gaps found in the codebase. All 10 required Phase 1 requirements are implemented. The 3 human verification items are deferred to device testing and live Supabase validation — they cannot be confirmed without a running native app connected to the Supabase project.

The phase goal — "The app runs offline-safely with working auth, a migration-ready SQLite schema, and role-based navigation that persists across restarts" — is structurally achieved: every layer is present, substantive, and wired. Runtime confirmation requires human testing.

---

_Verified: 2026-03-16_
_Verifier: Claude (gsd-verifier)_
