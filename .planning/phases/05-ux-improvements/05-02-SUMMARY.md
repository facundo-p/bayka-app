---
phase: 05-ux-improvements
plan: "02"
subsystem: mobile-screens
tags: [ux, connectivity, freshness, profile, header]
dependency_graph:
  requires: ["05-01"]
  provides: ["UX-CONN", "UX-FRESH", "UX-PROF", "UX-HEAD"]
  affects: ["PlantacionesScreen", "PerfilScreen"]
tech_stack:
  added: []
  patterns:
    - useFocusEffect for freshness check on screen focus
    - role-aware header derivation from useProfileData + isAdmin flag
    - cache-first profile card with loading fallback text
key_files:
  created: []
  modified:
    - mobile/src/screens/PlantacionesScreen.tsx
    - mobile/src/screens/PerfilScreen.tsx
decisions:
  - PlantacionesScreen header title: isAdmin && profile?.organizacionNombre ? org name : 'Mis plantaciones'
  - Freshness banner check in useFocusEffect — triggered on focus when online and plantationList is populated
  - PerfilScreen keeps roleLabel prop for backward compatibility with tab wrapper
  - ProfileRow extracted as local helper component for clean label/value rows
  - Pre-existing SubGroupRepository TS error (tipo cast) is out of scope — logged to deferred items
metrics:
  duration: "~10min"
  completed: "2026-03-29T00:29:17Z"
  tasks_completed: 3
  files_modified: 2
---

# Phase 5 Plan 02: UX Improvements — Screens Summary

Wire Phase 5 hooks and queries into the UI: contextual header titles + connectivity icon on PlantacionesScreen, freshness banner with "Actualizar" pull CTA, and expanded profile card on PerfilScreen.

## What Was Built

**PlantacionesScreen (`mobile/src/screens/PlantacionesScreen.tsx`):**
- Replaced static "Bayka" header title with role-aware title: org name for admin, "Mis plantaciones" for tecnico
- Added cloud connectivity icon (green `cloud-done-outline` when online, gray `cloud-offline-outline` when offline) on the right side of the header
- Added freshness banner ("Hay datos nuevos disponibles") that appears below the header when `checkFreshness()` returns true on screen focus
- Banner has an "Actualizar" button that calls `pullFromServer` for each plantation and calls `notifyDataChanged()` after, then hides the banner
- Imports: `useNetStatus`, `useProfileData`, `checkFreshness`, `pullFromServer`, `notifyDataChanged`, `Ionicons`

**PerfilScreen (`mobile/src/screens/PerfilScreen.tsx`):**
- Replaced minimal title+label with a full profile card with avatar circle (initial letter), name, email, divider, Rol row, Organizacion row, and Conexion status row
- Avatar uses `colors.primaryLight` background with white initial letter
- Connectivity status row shows cloud icon + "En linea" / "Sin conexion" text colored with `colors.online` / `colors.offline`
- `ProfileRow` helper component extracted for clean label/value layout
- Kept `roleLabel` prop for backward compatibility with tab wrapper
- Logout button preserved with `marginTop: spacing['5xl']`

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | PlantacionesScreen contextual header, connectivity icon, freshness banner | ea43cf2 | mobile/src/screens/PlantacionesScreen.tsx |
| 2 | PerfilScreen expanded profile card | 6cd3640 | mobile/src/screens/PerfilScreen.tsx |
| 3 | Visual verification checkpoint | (auto-approved) | — |

## Deviations from Plan

None - plan executed exactly as written.

Pre-existing TypeScript error in `src/repositories/SubGroupRepository.ts:273` (tipo cast from `string` to `SubGroupTipo`) was present before this plan and is out of scope. Logged as deferred item.

## Verification

- TypeScript compiles with no new errors (only pre-existing SubGroupRepository cast issue)
- Plan 01 tests all pass: 19/19 tests across useNetStatus, useProfileData, freshnessQueries
- Task 3 checkpoint:human-verify auto-approved (auto mode active)

## Self-Check: PASSED

- `mobile/src/screens/PlantacionesScreen.tsx` exists and contains all required imports and strings
- `mobile/src/screens/PerfilScreen.tsx` exists with profile card, ProfileRow, connectivity status
- Commits ea43cf2 and 6cd3640 exist in git log
