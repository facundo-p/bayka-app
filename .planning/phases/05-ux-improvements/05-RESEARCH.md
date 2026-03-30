# Phase 5: UX Improvements - Research

**Researched:** 2026-03-28
**Domain:** React Native connectivity awareness, data freshness, profile display, contextual headers
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Connectivity Feedback**
- Subtle icon in the header area (cloud with checkmark/X) — not a persistent banner or toast
- Icon changes color on transition (green → gray/red) without a separate notification
- Centralize connectivity state in a `useNetStatus()` hook wrapping NetInfo (currently used ad-hoc via `NetInfo.fetch()` in auth.ts and AssignTechniciansScreen)
- Add online/offline state colors to `src/theme.ts`

**Data Freshness Check**
- Check for server updates on screen focus when entering PlantacionesScreen (not periodic, not background)
- Compare local vs server timestamps on plantations/subgroups to detect changes
- Show inline banner below the header with "Hay datos nuevos disponibles" + "Actualizar" button
- Banner is dismissible and non-blocking — user decides when to pull
- Reuse existing `pullFromServer()` from SyncService for the actual data refresh
- Requires connectivity — if offline, skip the check silently (offline-first principle)

**Profile Screen**
- Read-only display: nombre, email, rol, organización
- Fetch from Supabase `profiles` table (extends existing pattern in useAuth/adminQueries)
- Cache profile data locally after first fetch to support offline viewing
- No edit functionality — out of scope for v1
- Current PerfilScreen only shows role + logout button — expand with profile card

**Contextual Plantaciones Header**
- Tecnico sees: "Mis plantaciones" as header title
- Admin sees: organization name as header title (fetched from profiles → organizations)
- Replace current static "Bayka" title in PlantacionesScreen
- Online/offline indicator integrated into this header area

**Background Species Catalog Updates**
- Species catalog is included in the freshness pull via existing `pullFromServer()` — no new mechanism

### Claude's Discretion
- Exact icon choice for connectivity indicator (Ionicons has cloud/wifi variants)
- Banner animation and styling details
- Profile card layout within PerfilScreen
- How to cache profile data (SecureStore vs SQLite)
- Freshness check debounce/cooldown to avoid excessive server calls

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 5 is a polish phase layered on top of a fully-working offline-first app. All four feature areas (connectivity indicator, data freshness banner, profile screen, contextual header) integrate with existing infrastructure — no new libraries, no new Supabase tables, no schema migrations.

The highest-risk design decision is the **freshness check**: it requires a lightweight server query that detects whether remote data has changed since the last local pull. The simplest approach is comparing a `MAX(updated_at)` aggregate from the server against the newest local `created_at` timestamp for subgroups. This avoids a dedicated `updated_at` column on the server-side view (the Supabase schema has `created_at` on subgroups and the migration shows no `updated_at`).

The **profile cache** decision (SecureStore vs SQLite) is the second notable discretion item. Given that the profiles table has only 4 fields (`nombre`, `rol`, `organizacion_id`, `created_at`) and the organization name requires a join (`organizations.nombre`), SecureStore with simple JSON serialization is sufficient and avoids adding a local table.

**Primary recommendation:** Build four focused units in this order: (1) `useNetStatus` hook, (2) theme colors + connectivity icon in header, (3) profile fetch + cache + expanded PerfilScreen, (4) freshness check on PlantacionesScreen focus. Each unit is self-contained and independently verifiable.

---

## Standard Stack

### Core (all already installed — zero new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@react-native-community/netinfo` | 11.4.1 | Network state subscription + one-shot fetch | Already installed; used ad-hoc in auth.ts and AssignTechniciansScreen |
| `@expo/vector-icons` (Ionicons) | SDK 55 bundled | Connectivity icon | Already used throughout the app for all icons |
| `expo-secure-store` | ~15.0.8 | Caching profile data offline | Already used for auth tokens and role; same pattern |
| `@supabase/supabase-js` | ^2.99.2 | Profile + organization fetch | Already used everywhere |

### No New Dependencies Required

All Phase 5 features use exclusively existing infrastructure. No `npm install` step.

---

## Architecture Patterns

### Recommended Project Structure additions

```
mobile/src/
├── hooks/
│   ├── useNetStatus.ts        # NEW — centralized NetInfo subscription
│   └── useProfileData.ts      # NEW — fetches + caches profile info
├── queries/
│   └── freshnessQueries.ts    # NEW — lightweight server freshness check
├── screens/
│   └── PlantacionesScreen.tsx # MODIFY — contextual title, freshness banner
│   └── PerfilScreen.tsx       # MODIFY — expanded profile card
└── theme.ts                   # MODIFY — add colors.online / colors.offline
```

### Pattern 1: useNetStatus Hook

**What:** Wraps `NetInfo.addEventListener` to produce a reactive boolean `isOnline` across the app.
**When to use:** Any component needing live connectivity state (header icon, freshness check guard).

**Implementation notes:**
- NetInfo `addEventListener` returns an unsubscribe function — clean up in `useEffect` return.
- Initial state comes from `NetInfo.fetch()` synchronously-ish — the subscription fires immediately on mount with current state, so no separate `fetch()` call needed.
- `isConnected` can be `null` during initialization — treat `null` as offline (safe default).
- Expose `isOnline: boolean` (null → false) to callers.

```typescript
// Pattern (verified against @react-native-community/netinfo docs)
import NetInfo from '@react-native-community/netinfo';
import { useState, useEffect } from 'react';

export function useNetStatus() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    // Fires immediately with current state
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
    });
    return unsubscribe;
  }, []);

  return { isOnline };
}
```

**Icon recommendation (Claude's discretion):** `cloud-done-outline` (online, green) / `cloud-offline-outline` (offline, gray) from Ionicons. These are unambiguous and already available in the Ionicons set bundled with `@expo/vector-icons`.

### Pattern 2: Contextual Header Title in PlantacionesScreen

**What:** Replace static `"Bayka"` text (line 59 of PlantacionesScreen.tsx) with role-aware dynamic title. Integrate connectivity icon as `rightElement`-equivalent.

**Current state:** PlantacionesScreen renders its own inline `header` View, not `CustomHeader`. The header has a `rightElement`-style `View style={styles.headerRight}` but no prop. The connectivity icon should be placed as a sibling to the title text in `styles.header`.

**Option A (simpler):** Add connectivity icon inline to PlantacionesScreen's own header View — no need to refactor to use `CustomHeader` (PlantacionesScreen has no back button).
**Option B:** Extend PlantacionesScreen header directly to match existing `CustomHeader` layout, adding a right slot.

Recommendation: Option A. The tab-root screens don't use `CustomHeader` (no back button needed). Extend the inline header.

**Organization name fetch:** Admin's organization name requires:
1. `supabase.from('profiles').select('organizacion_id').eq('id', userId)` — already done per-screen in AdminScreen and AssignTechniciansScreen
2. `supabase.from('organizations').select('nombre').eq('id', organizacionId)` — one additional query

Consolidate into `useProfileData` hook so both PerfilScreen and PlantacionesScreen share one fetch.

### Pattern 3: useProfileData Hook

**What:** Fetches full profile from Supabase (nombre, email, rol, organizacion_id) + organization name. Caches in SecureStore.

**Cache strategy (Claude's discretion):** SecureStore with a single JSON blob under key `user_profile_cache`. Profile data is tiny (~200 bytes). SecureStore limit is 2048 bytes but the STATE.md decision log notes tokens are stored separately as two keys to avoid the limit — profile JSON is small enough as one key.

```typescript
// Pseudocode pattern
const PROFILE_CACHE_KEY = 'user_profile_cache';

type CachedProfile = {
  nombre: string;
  email: string;
  rol: string;
  organizacionId: string;
  organizacionNombre: string;
};
```

Load order:
1. Read SecureStore cache immediately → show cached data (offline-safe)
2. If online, fetch from Supabase → update state + write back to SecureStore

**Email source:** `supabase.auth.getUser()` returns `user.email` — already available without extra query.

### Pattern 4: Freshness Check on Screen Focus

**What:** On `useFocusEffect` in PlantacionesScreen, when online, run a lightweight server query to get the max `created_at` of subgroups for all plantations accessible to the user. Compare against local max. If server is newer, show banner.

**Freshness query design:**
- Server: `SELECT MAX(created_at) FROM subgroups WHERE plantation_id IN (user's plantations)`
- Local: `SELECT MAX(created_at) FROM subgroups` (Drizzle query in `freshnessQueries.ts`)
- If `serverMax > localMax` → data available

**RLS consideration:** The existing `subgroups` RLS policy (from 003_admin_policies.sql) already restricts what users can see. A simple `MAX(created_at)` Supabase query will respect RLS automatically.

**Cooldown (Claude's discretion):** Use a module-level `lastCheckedAt` timestamp. Skip the check if it was run within the last 30 seconds. This prevents rapid focus/unfocus causing excessive requests in field conditions.

```typescript
// Module-level cooldown (simple, no state management)
let lastFreshnessCheck = 0;
const FRESHNESS_COOLDOWN_MS = 30_000;

export async function checkFreshness(plantacionIds: string[]): Promise<boolean> {
  if (Date.now() - lastFreshnessCheck < FRESHNESS_COOLDOWN_MS) return false;
  lastFreshnessCheck = Date.now();
  // ... query logic
}
```

**Banner state management:** Local `useState` inside PlantacionesScreen.
- `showFreshnessBanner: boolean`
- Banner shown when check returns true; dismissed by user tap or after successful pull.

### Anti-Patterns to Avoid

- **Calling `NetInfo.fetch()` directly in components:** The existing ad-hoc pattern in AssignTechniciansScreen is legacy. New code uses `useNetStatus()` only.
- **Fetching org name separately in every screen:** Currently AdminScreen and AssignTechniciansScreen each fetch `organizacion_id` independently — Phase 5 consolidates into `useProfileData` hook. Don't replicate the per-screen pattern.
- **Importing `db` in screens:** CLAUDE.md strictly prohibits this. Freshness queries go in `src/queries/freshnessQueries.ts`.
- **Running freshness check without cooldown:** Field workers frequently navigate away and back; without a cooldown, every focus event would hit the server.
- **Storing profile data in SQLite:** Overkill for 4 fields. SecureStore is the right choice here (auth tokens already live there).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Network state subscription | Custom polling loop | `NetInfo.addEventListener` | Handles all edge cases (WiFi with no internet, airplane mode, etc.) |
| Data pull on refresh | New sync mechanism | `pullFromServer(plantacionId)` in SyncService | Already handles all entities (subgroups, plantation_users, plantation_species, trees) |
| Profile offline caching | Local SQLite profiles table | SecureStore JSON cache | Zero migration needed; already established SecureStore pattern |
| Organization name lookup | Joining organizations in local SQLite | Supabase query on first load (cached after) | profiles table is server-only by design |

---

## Common Pitfalls

### Pitfall 1: NetInfo `isConnected: true` but no internet
**What goes wrong:** `isConnected` can be true on a WiFi network with no actual internet (captive portal, dead router). Freshness check would attempt server query and fail silently.
**How to avoid:** Use `isConnected === true && isInternetReachable !== false`. The `isInternetReachable` field can be `null` (unknown) — treat null as "assume reachable" (don't block on uncertainty). The check failure is graceful anyway since it's a silent skip.
**Warning signs:** Freshness check never triggers even on WiFi.

### Pitfall 2: useFocusEffect dependency stability
**What goes wrong:** `useFocusEffect` callback recreated on every render causes the freshness check to run more than expected.
**How to avoid:** Wrap the callback in `useCallback` with stable deps (module-level cooldown handles re-run frequency). `useLiveData` already uses this pattern correctly.
**Warning signs:** Console shows freshness check running on every keystroke or state change.

### Pitfall 3: Profile fetch race between cache and live data
**What goes wrong:** Component renders with stale cached profile, then live data arrives and causes a jarring name change.
**How to avoid:** Show cached data immediately (no loading state for repeat visits), update in background. The user sees their own name which rarely changes — a brief "old → new" transition is acceptable.

### Pitfall 4: SecureStore 2048-byte limit
**What goes wrong:** The profile JSON blob is too large.
**How to avoid:** Store only: `nombre`, `email`, `rol`, `organizacionId`, `organizacionNombre`. Total well under 200 bytes. The STATE.md decision log documents this limit; it was the reason access/refresh tokens are stored as separate keys.

### Pitfall 5: Freshness check uses all plantation IDs (not user-scoped)
**What goes wrong:** Server query fetches MAX(created_at) across all plantations visible to the user, but local SQLite only has data for assigned plantations. Admin may see "data available" when new subgroups exist in a plantation they're not focused on.
**How to avoid:** Scope the server query to the same plantation IDs that appear in the local list. Use the `plantationList` from `getPlantationsForRole()` as the filter. This is consistent — if it's in the list, it's relevant.

### Pitfall 6: org name not available offline for header
**What goes wrong:** Admin header shows empty string on first offline launch before profile cache is populated.
**How to avoid:** `useProfileData` returns `null` when no cache exists. PlantacionesScreen header falls back to `"Mis plantaciones"` for both roles if org name is null (safe default).

---

## Code Examples

### Existing NetInfo usage to replace (ad-hoc pattern)

```typescript
// CURRENT: auth.ts — one-shot fetch, no subscription
const net = await NetInfo.fetch();
if (!net.isConnected) { ... }

// CURRENT: AssignTechniciansScreen — one-shot in useEffect
const netState = await NetInfo.fetch();
setIsOnline(netState.isConnected ?? false);
```

Both of these should be kept as-is (they are point-in-time checks). New UI components use `useNetStatus()` for reactive state.

### Supabase profile fetch pattern (existing, from adminQueries.ts / AdminScreen)

```typescript
// Established pattern — already works in AdminScreen and AssignTechniciansScreen
const { data: { user } } = await supabase.auth.getUser();
const { data: profile } = await supabase
  .from('profiles')
  .select('organizacion_id, nombre, rol')
  .eq('id', user.id)
  .single();
```

### Organization name fetch (new, follows existing pattern)

```typescript
// One additional query after profile fetch
const { data: org } = await supabase
  .from('organizations')
  .select('nombre')
  .eq('id', profile.organizacion_id)
  .single();
```

### Freshness server query

```typescript
// Lightweight MAX(created_at) check
const { data } = await supabase
  .from('subgroups')
  .select('created_at')
  .in('plantation_id', plantacionIds)
  .order('created_at', { ascending: false })
  .limit(1)
  .single();
// data?.created_at is the server's newest subgroup timestamp
```

### Local max query (in freshnessQueries.ts)

```typescript
// Drizzle ORM — goes in src/queries/freshnessQueries.ts
export async function getLocalMaxSubgroupCreatedAt(): Promise<string | null> {
  const result = await db
    .select({ maxCreatedAt: sql<string>`MAX(${subgroups.createdAt})` })
    .from(subgroups);
  return result[0]?.maxCreatedAt ?? null;
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `NetInfo.fetch()` per-component | `useNetStatus()` reactive hook | Phase 5 introduces the hook; legacy usages stay as-is |
| PerfilScreen: role + logout only | Full profile card with name, email, org | Phase 5 expansion |
| PlantacionesScreen: "Bayka" static title | Role-aware + org-name contextual title | Phase 5 |
| No freshness signal | Focus-triggered banner with pull CTA | Phase 5 |

---

## Open Questions

1. **Organization name RLS policy**
   - What we know: `organizations` table has RLS enabled (from migration). Profiles can select their own row.
   - What's unclear: Can a user select from `organizations` by ID? The migration shows `profiles` RLS but not explicit `organizations` select policy for authenticated users.
   - Recommendation: Test the `organizations` select query manually against Supabase. If blocked, use a Supabase function or join the org name into the profiles query via a view or RPC. Low risk — this same fetch pattern would have been needed for other features if org name were displayed elsewhere.
   - **Mitigation fallback:** If org name query fails, fall back to `"Mi organización"` as the admin header title.

2. **`isInternetReachable` on Android**
   - What we know: NetInfo `isInternetReachable` is more reliable on iOS than Android (Android may always return `null`).
   - Recommendation: Use `isConnected === true && isInternetReachable !== false` as guard. This means Android treats null as "assume reachable" and attempts the check. Failures are silent skips, so this is acceptable.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest + jest-expo |
| Config file | `mobile/jest.config.js` |
| Quick run command | `cd mobile && npx jest --testPathPattern=hooks/useNetStatus --no-coverage` |
| Full suite command | `cd mobile && npx jest --no-coverage` |

### Phase Requirements → Test Map

| Feature | Behavior | Test Type | Automated Command | File Exists? |
|---------|----------|-----------|-------------------|-------------|
| useNetStatus | Returns false when NetInfo reports disconnected | unit | `npx jest tests/hooks/useNetStatus.test.ts -x` | No — Wave 0 |
| useNetStatus | Returns true when connected + reachable | unit | `npx jest tests/hooks/useNetStatus.test.ts -x` | No — Wave 0 |
| useProfileData | Returns cached profile when offline | unit | `npx jest tests/hooks/useProfileData.test.ts -x` | No — Wave 0 |
| useProfileData | Fetches and caches on first online load | unit | `npx jest tests/hooks/useProfileData.test.ts -x` | No — Wave 0 |
| freshnessQueries | getLocalMaxSubgroupCreatedAt returns correct MAX | unit | `npx jest tests/queries/freshnessQueries.test.ts -x` | No — Wave 0 |
| Freshness check logic | Returns true when server max > local max | unit | `npx jest tests/queries/freshnessQueries.test.ts -x` | No — Wave 0 |
| Freshness check cooldown | Skips check within cooldown window | unit | `npx jest tests/queries/freshnessQueries.test.ts -x` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `cd mobile && npx jest --testPathPattern=tests/(hooks|queries) --no-coverage`
- **Per wave merge:** `cd mobile && npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `mobile/tests/hooks/useNetStatus.test.ts` — covers NetInfo reactive hook
- [ ] `mobile/tests/hooks/useProfileData.test.ts` — covers profile fetch + SecureStore cache
- [ ] `mobile/tests/queries/freshnessQueries.test.ts` — covers MAX query + cooldown logic

*(Existing test infrastructure: jest-expo, testEnvironment: node, mocks in `tests/__mocks__/`, setup in `tests/setup.ts` — no new framework installs needed)*

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read — `mobile/src/hooks/useAuth.ts`, `SyncService.ts`, `useSync.ts`, `CustomHeader.tsx`, `PerfilScreen.tsx`, `PlantacionesScreen.tsx`, `adminQueries.ts`, `AssignTechniciansScreen.tsx`, `theme.ts`, `liveQuery.ts`
- Direct schema read — `supabase/migrations/001_initial_schema.sql`
- `mobile/package.json` — confirmed installed versions

### Secondary (MEDIUM confidence)
- `@react-native-community/netinfo` README (known API from codebase usage in auth.ts; `addEventListener` + `fetch` patterns confirmed present)

### Tertiary (LOW confidence)
- `isInternetReachable` Android behavior — known limitation from community reports; not re-verified in this session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all verified present in package.json
- Architecture: HIGH — all patterns derive from existing codebase code; no speculation
- Pitfalls: HIGH for Pitfall 4 (SecureStore limit is a documented project decision in STATE.md); MEDIUM for Pitfall 1 (NetInfo edge cases from community knowledge)
- Open questions: LOW — org RLS is a single query test away; unlikely to block

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable libraries, no external API changes expected)
