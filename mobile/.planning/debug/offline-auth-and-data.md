---
status: awaiting_human_verify
trigger: "Two critical bugs when offline: (1) cannot sign out, (2) no local data shown after offline reopen"
created: 2026-04-06T00:00:00Z
updated: 2026-04-06T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED — two distinct root causes identified
test: n/a — both confirmed by reading code
expecting: fixes applied and verified
next_action: implement fixes for both bugs

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected:
1. User can sign out even without internet
2. App shows locally-stored SQLite data (plantaciones, subgrupos, trees) when offline

actual:
1. Sign out fails/is blocked when offline
2. App opens, authenticates from local storage, shows profile info, but data screens are empty when offline. With internet, same data appears.

errors: No specific error messages reported — data simply doesn't show

reproduction:
1. Download plantaciones while online
2. Turn off wifi/data (airplane mode)
3. Try to sign out → fails
4. Close app completely, reopen → enters app but data screens are empty

started: ongoing — manifests in production APK or truly offline. Works fine in Expo Go dev mode.

## Eliminated

- hypothesis: liveQuery / SQLite itself is broken offline
  evidence: useLiveData and db client are purely local — no network dependency
  timestamp: 2026-04-06T00:01:00Z

- hypothesis: migrations or database init fails offline
  evidence: useMigrations runs synchronously from bundled migration files, no network needed
  timestamp: 2026-04-06T00:01:00Z

## Evidence

- timestamp: 2026-04-06T00:01:00Z
  checked: useCurrentUserId.ts
  found: calls supabase.auth.getUser() — this makes a NETWORK request to validate the token with Supabase server
  implication: offline → getUser() fails/times out → userId stays null → getPlantationsForRole(isAdmin=false, null) → returns [] early → screen shows "No hay plantaciones"

- timestamp: 2026-04-06T00:01:00Z
  checked: dashboardQueries.ts getPlantationsForRole()
  found: line 22 — `if (!userId) return [];` — explicitly returns empty when userId is null
  implication: technician role gets empty list whenever userId is null, confirmed data disappears

- timestamp: 2026-04-06T00:01:00Z
  checked: useAuth.ts signOut()
  found: calls await supabase.auth.signOut() unconditionally — in supabase-js v2 this hits the network to revoke the session on the server; if offline it hangs or throws a network error
  implication: the try/catch DOES catch it, but the real issue is in production where the network call may time out (long hang before catching), OR the SIGNED_OUT auth state event doesn't fire when signOut() is called offline after the network call fails/is aborted, leaving session/role state not cleared

- timestamp: 2026-04-06T00:01:00Z
  checked: useAuth.ts signOut() — code after try/catch
  found: clearSession(), setSession(null), setRole(null) are called AFTER the try block regardless of supabase.auth.signOut() success
  implication: these local clears DO run. The hang is the real problem — supabase.auth.signOut() with scope='global' (default) may block for the full network timeout before the catch fires

- timestamp: 2026-04-06T00:01:00Z
  checked: supabase.auth.getUser() vs getSession()
  found: getUser() verifies token with server (network call). getSession() reads from local AsyncStorage (no network). The hook already uses getSession() for the main auth flow but useCurrentUserId uses getUser() instead
  implication: useCurrentUserId should use getSession() instead of getUser() for offline compatibility

## Resolution

root_cause:
  BUG 1 (sign out hangs offline): supabase.auth.signOut() makes a network call to revoke the session server-side. In supabase-js v2, the default scope='global' always hits the network. When offline, this hangs for the full TCP timeout (potentially 30-60s) before the catch fires. Fix: pass { scope: 'local' } to signOut() so it only clears local storage without a network call.

  BUG 2 (empty data offline): useCurrentUserId calls supabase.auth.getUser() which makes a server-side network call to validate the JWT. When offline it fails/times out, userId stays null forever. getPlantationsForRole(false, null) returns [] early. Fix: replace getUser() with getSession() (reads AsyncStorage locally) to get the user ID without any network call.

fix:
  Fix 1: In useAuth.ts signOut(), change `await supabase.auth.signOut()` to `await supabase.auth.signOut({ scope: 'local' })` — this clears the local session without hitting the network.
  Fix 2: In useCurrentUserId.ts, replace `supabase.auth.getUser()` with `supabase.auth.getSession()` and extract user id from session.user.id.

verification: awaiting human confirmation in real device / offline conditions
files_changed:
  - mobile/src/hooks/useAuth.ts
  - mobile/src/hooks/useCurrentUserId.ts
