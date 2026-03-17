---
phase: 01-foundation-auth
plan: 03
subsystem: auth
tags: [auth, supabase, offline, navigation, expo-router, react-native]
dependency_graph:
  requires: [01-01, 01-02]
  provides: [auth-flow, session-persistence, role-navigation]
  affects: [all-subsequent-phases]
tech_stack:
  added: [expo-secure-store (separate keys), @react-native-community/netinfo, AsyncStorage mock]
  patterns: [offline-safe-session-restore, role-cached-in-securestore, tdd-red-green]
key_files:
  created:
    - mobile/src/supabase/client.ts
    - mobile/src/supabase/auth.ts
    - mobile/src/hooks/useAuth.ts
    - mobile/app/(auth)/_layout.tsx
    - mobile/app/(auth)/login.tsx
    - mobile/app/(tecnico)/_layout.tsx
    - mobile/app/(tecnico)/plantaciones.tsx
    - mobile/app/(tecnico)/perfil.tsx
    - mobile/app/(admin)/_layout.tsx
    - mobile/app/(admin)/plantaciones.tsx
    - mobile/app/(admin)/admin.tsx
    - mobile/app/(admin)/perfil.tsx
    - mobile/tests/auth/session.test.ts
    - mobile/tests/auth/logout.test.ts
    - mobile/tests/auth/role.test.ts
    - mobile/tests/auth/multiuser.test.ts
  modified:
    - mobile/app/_layout.tsx
    - mobile/tests/setup.ts
decisions:
  - "Store access_token and refresh_token as separate SecureStore keys (avoids 2048-byte limit per Pitfall 4)"
  - "Role cached in SecureStore (user_role key) on first online login — read offline without network call"
  - "restoreSession checks NetInfo.isConnected before calling supabase.auth.setSession — prevents offline session eviction"
  - "clearSession deletes 4 keys: supabase_access_token, supabase_refresh_token, user_role, last_email"
  - "Login screen pre-fills last email from SecureStore (last_email key) per locked UX decision"
  - "Spanish error message: 'Email o contraseña incorrectos' per CONTEXT.md locked decision"
metrics:
  duration: 296s
  completed: 2026-03-16
  tasks_completed: 2
  files_created: 16
  files_modified: 2
---

# Phase 1 Plan 3: Auth Flow + Role Navigation Summary

**One-liner:** Offline-safe Supabase session with SecureStore split-key storage, useAuth hook with cached role, and Expo Router role-based tab navigation (admin 3-tab, tecnico 2-tab).

## What Was Built

### Task 1: Supabase Client + Offline Session Helpers + useAuth Hook

**`mobile/src/supabase/client.ts`**
Supabase client configured with `detectSessionInUrl: false` (required for React Native), `AsyncStorage` as session backend, and `autoRefreshToken: true` (graceful online refresh without blocking offline use).

**`mobile/src/supabase/auth.ts`**
Session persistence helpers using split SecureStore keys to avoid the 2048-byte limit:
- `ACCESS_TOKEN_KEY = 'supabase_access_token'`
- `REFRESH_TOKEN_KEY = 'supabase_refresh_token'`
- `ROLE_KEY = 'user_role'`
- `EMAIL_KEY = 'last_email'`

`restoreSession()` checks connectivity via `NetInfo.fetch()` before calling `supabase.auth.setSession()` — if offline, returns cached tokens directly (no network call, no session eviction).

**`mobile/src/hooks/useAuth.ts`**
Auth state hook: on mount restores session from SecureStore, reads role from `user_role` key (offline-safe). On SIGNED_IN event, fetches role from profiles table (online only, first login) and caches it. On SIGNED_OUT, calls `clearSession()`.

### Task 2: Root Layout + Login Screen + Role Navigation

**`mobile/app/_layout.tsx`** (updated)
Execution order: migration gate → species seed (after success) → auth loading state → redirect to login or role tab group.

**`mobile/app/(auth)/login.tsx`**
Centered form with Spanish labels, keyboard-avoiding scroll, pre-fill last email from SecureStore, inline red error below form. No "forgot password" link per locked decision.

**`mobile/app/(tecnico)/_layout.tsx`** — 2 tabs: Plantaciones + Perfil
**`mobile/app/(admin)/_layout.tsx`** — 3 tabs: Plantaciones + Admin + Perfil

Both perfil screens have `signOut()` logout button ("Cerrar sesión").

## SecureStore Keys (Reference for Phase 3 Sync)

| Key | Value | Set when | Cleared when |
|-----|-------|----------|-------------|
| `supabase_access_token` | JWT access token | login / token refresh | logout |
| `supabase_refresh_token` | Supabase refresh token | login / token refresh | logout |
| `user_role` | `'admin'` or `'tecnico'` | first online login | logout |
| `last_email` | last successful login email | first online login | logout |

## Test Results

- 13/13 tests passing across 6 test suites
- `src/supabase/auth.ts`: 100% statement coverage, 100% branch coverage
- Auth test suite: 7 tests (session.test.ts, logout.test.ts, role.test.ts, multiuser.test.ts)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing AsyncStorage mock in test setup**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** `logout.test.ts` required `../../src/supabase/auth` which imports `./client` which imports `@react-native-async-storage/async-storage`. The native module failed to load in Jest test environment.
- **Fix:** Added `@react-native-async-storage/async-storage` mock to `mobile/tests/setup.ts` (applied globally to all tests). Also added explicit supabase client mock to `logout.test.ts` to prevent client module loading.
- **Files modified:** `mobile/tests/setup.ts`, `mobile/tests/auth/logout.test.ts`
- **Commit:** 72e617b (included in Task 1 commit)

## Checkpoint

Auto-approved (auto_advance=true): Complete auth flow — login screen, offline-safe session, role-based navigation, logout — all wired end to end.

## Self-Check

- [x] `mobile/src/supabase/client.ts` created
- [x] `mobile/src/supabase/auth.ts` created
- [x] `mobile/src/hooks/useAuth.ts` created
- [x] `mobile/app/_layout.tsx` updated with useAuth + Redirect
- [x] `mobile/app/(auth)/login.tsx` created with "Iniciar sesión"
- [x] `mobile/app/(tecnico)/_layout.tsx` has 2 Tabs.Screen
- [x] `mobile/app/(admin)/_layout.tsx` has 3 Tabs.Screen
- [x] All 13 tests pass
- [x] TypeScript exits 0
