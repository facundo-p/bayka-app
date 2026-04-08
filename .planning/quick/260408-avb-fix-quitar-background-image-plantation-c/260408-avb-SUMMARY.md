---
phase: quick
plan: 260408-avb
subsystem: mobile/components
tags: [ui, plantation-card, theme, brand-colors]
dependency_graph:
  requires: []
  provides: [PlantationCard without background image]
  affects: [PlantacionesScreen]
tech_stack:
  added: []
  patterns: [colors.* from theme.ts, solid surface background]
key_files:
  modified:
    - mobile/src/components/PlantationCard.tsx
decisions:
  - Use colors.white for sidebar leaf icon (matches existing theme pattern)
  - Use leaf-outline Ionicons icon for tree stat (TreeIcon not available in redesign project)
  - Keep sidebar + content split layout — only replace image area with plain View
metrics:
  duration: "~5min"
  completed: "2026-04-08T10:52:29Z"
  tasks: 1
  files: 1
---

# Quick Fix 260408-avb: Remove Background Image from PlantationCard Summary

**One-liner:** Replaced ImageBackground + dark overlay with plain solid-color View, wiring all text to brand color tokens from theme.ts.

## What Was Done

Refactored `PlantationCard.tsx` on the `feature/plantation-card-texture` branch:

- Removed `ImageBackground` import, `defaultTexture` require, and `overlay` View
- Replaced the image area with a plain `<View style={styles.content}>` using `colors.surface` (white)
- Updated text colors: `title` → `colors.textHeading`, `subtitle` → `colors.textSecondary`
- Stat values now use semantic colors: `colors.statTotal`, `colors.statSynced`, `colors.statToday`
- Pending sync banner: background → `colors.infoBg`, icon → `colors.info`, text → `colors.textPrimary`
- Removed unused styles: `imageArea`, `imageStyle`, `overlay`
- Zero hardcoded hex values remain — all colors from `theme.ts`

## Verification

- TypeScript: compiles with no errors (`npx tsc --noEmit`)
- No `ImageBackground` or `require` references: confirmed (grep count = 0)
- No hardcoded `#FFFFFF` or `rgba`: confirmed (grep count = 0)

## Deviations from Plan

None — plan executed exactly as written. The `TreeIcon` component referenced in the plan was not used since the redesign project uses `MaterialCommunityIcons`/`Ionicons` directly; `leaf-outline` from Ionicons was used for the tree stat icon instead.

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Remove ImageBackground, solid brand colors | 9698d70 |

## Self-Check: PASSED

- File exists: `/Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app-redesign/mobile/src/components/PlantationCard.tsx` — FOUND
- Commit 9698d70 — FOUND
