---
phase: quick
plan: 260408-c1r
subsystem: mobile/plantation-detail
tags: [ux, offline, caching, subgroup-cards]
dependency_graph:
  requires: []
  provides: [creator-name-display-on-subgroup-cards]
  affects: [PlantationDetailScreen, useUserNames]
tech_stack:
  added: ["@react-native-async-storage/async-storage (already installed)"]
  patterns: ["cache-first AsyncStorage read, then Supabase fetch for uncached IDs"]
key_files:
  created:
    - mobile/src/hooks/useUserNames.ts
  modified:
    - mobile/src/screens/PlantationDetailScreen.tsx
decisions:
  - "AsyncStorage chosen over SecureStore for user names cache — not sensitive data, no 2048-byte limit concern"
  - "getDisplayName uses initials (not truncation ellipsis) for names >15 chars — shorter and works better in compact card layout"
  - "useMemo with JSON.stringify for stable userIds dependency — avoids re-fetching on every render"
metrics:
  duration: ~8min
  completed_date: "2026-04-08T11:45:13Z"
  tasks: 2
  files: 2
---

# Quick Task 260408-c1r: Mostrar creador en subgroup cards — Summary

**One-liner:** Supabase-backed user name resolution with AsyncStorage cache, displayed as subtle gray text on each subgroup card.

## What Was Built

### Task 1: useUserNames hook (mobile/src/hooks/useUserNames.ts)

`useUserNames(userIds: string[]): Record<string, string>` resolves an array of user UUIDs to display names with a cache-first offline strategy:

1. On mount, reads `user_names_cache` from AsyncStorage and immediately populates state with any matching cached names.
2. Identifies uncached UUIDs and queries Supabase `profiles` table (`.select('id, nombre').in('id', uncachedIds)`).
3. Merges results back into cache and updates state.
4. All Supabase calls are wrapped in try/catch — offline users see cached names without any errors.

Exported helpers:
- `getInitials(nombre)` — first letter of each word, max 2, uppercase. "Juan Perez" -> "JP".
- `getDisplayName(nombre, maxLength=15)` — returns nombre if fits, otherwise initials.

### Task 2: Creator name display on subgroup cards (PlantationDetailScreen.tsx)

- Added `useMemo` to `creatorIds` extraction from `subgroupRows` (stable dep via JSON.stringify in hook).
- Called `useUserNames(creatorIds)` at screen level (not inside renderSubGroup) to batch resolve all creators.
- In `renderSubGroup`: reads `userNames[item.usuarioCreador]` and conditionally renders `<Text style={styles.cardCreator}>` below the main `cardRow`.
- `cardCreator` style: `fontSize.xs`, `fonts.regular`, `colors.textMuted`, `marginTop: spacing.xs` — all from theme.ts, no hardcoded values.

## Verification

- TypeScript: `npx tsc --noEmit` exits cleanly (no errors).
- Creator name appears below subgroup name on cards where a resolved name exists.
- Cards without a resolved name (race condition before Supabase fetch) show nothing — graceful degradation.
- Airplane mode: names fetched during online session persist in AsyncStorage and render on next offline open.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

Files created:
- mobile/src/hooks/useUserNames.ts — FOUND

Commits:
- bc46631 feat(quick-260408-c1r): add useUserNames hook with AsyncStorage caching — FOUND
- 2fe1e59 feat(quick-260408-c1r): show creator name on subgroup cards — FOUND
