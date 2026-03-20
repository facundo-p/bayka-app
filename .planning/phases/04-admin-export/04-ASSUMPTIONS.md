# Phase 4: Admin + Export — Assumptions Register

**Created:** 2026-03-20
**Status:** Pre-implementation

> Tracks all assumptions made during planning. After implementation, each gets a resolution status.

## Pre-Implementation Assumptions

### Technical Approach

| # | Assumption | Confidence | User Correction | Status |
|---|-----------|------------|-----------------|--------|
| T1 | Supabase RLS migration (003) needed — no INSERT policies exist for plantations, plantation_species, plantation_users | Fairly confident | — | ⬜ pending |
| T2 | Creating a plantation requires connectivity (INSERT on Supabase first, then sync local) | Fairly confident | — | ⬜ pending |
| T3 | ID generation is local-only — operates on already-synced SQLite data, no network needed | Fairly confident | — | ⬜ pending |
| T4 | Export uses `xlsx` (SheetJS) for Excel, string building for CSV, `expo-sharing` for share sheet | Fairly confident | — | ⬜ pending |
| T5 | ~~Move-up/down buttons for species reorder~~ → **Drag-and-drop** for species reorder | Assuming → Corrected | User: "Los botones se reordenan con drag and drop" | 🔄 corrected |
| T6 | New `PlantationRepository.ts` for all admin mutations (create, finalize, saveSpeciesConfig, assignTechnicians, generateIds) | Assuming | — | ⬜ pending |
| T7 | Technician profiles read from Supabase `profiles` table (needs RLS policy for admin to read all technicians) | Assuming | — | ⬜ pending |

### Implementation Order

| # | Assumption | Confidence | Status |
|---|-----------|------------|--------|
| O1 | Wave 1: RLS migration + data layer + 21 unit tests (TDD) | Fairly confident | ⬜ pending |
| O2 | Wave 2: Admin screens (AdminScreen, ConfigureSpecies, AssignTechnicians) + routes | Fairly confident | ⬜ pending |
| O3 | Wave 3: ID generation + export wiring + finalization lockout + checkpoint | Fairly confident | ⬜ pending |

### Scope Boundaries

| # | Item | Boundary | Confidence | Status |
|---|------|----------|------------|--------|
| S1 | Create plantation (lugar + periodo) | In scope | Fairly confident | ⬜ pending |
| S2 | Configure species (checklist + drag reorder) | In scope | Fairly confident | ⬜ pending |
| S3 | Assign AND unassign technicians | In scope | Corrected | 🔄 corrected |
| S4 | Finalize plantation (gate: all SubGroups sincronizada) | In scope | Corrected | 🔄 corrected |
| S5 | Generate IDs (IdPlantacion sequential + IdGlobal with seed) | In scope | Fairly confident | ⬜ pending |
| S6 | Export CSV + Excel (7 columns) | In scope | Fairly confident | ⬜ pending |
| S7 | Edit plantation after creation | Out of scope | Assuming | ⬜ pending |
| S8 | Delete plantation | Out of scope | Assuming | ⬜ pending |
| S9 | Manage global species catalog | Out of scope | Fairly confident | ⬜ pending |
| S10 | Create new users/technicians | Out of scope | Fairly confident | ⬜ pending |

### Clarifications from User (pre-implementation)

| # | Topic | Original Assumption | User Clarification |
|---|-------|--------------------|--------------------|
| C1 | Species reorder UX | Move-up/down arrow buttons | **Drag-and-drop**, not arrows |
| C2 | Technician unassignment | Unclear if admin can unassign | **Yes** — unassigned tecnico can't create SubGroups, but synced data stays intact |
| C3 | Finalization gate for non-synced | Only checked "all sincronizada" | **Block and warn** if ANY SubGroup is activa or finalizada (not sincronizada) |

### Risk Areas

| # | Risk | Severity | Mitigation | Status |
|---|------|----------|------------|--------|
| R1 | RLS policies misconfigured → admin operations fail silently | High | E2E test with real Supabase | ⬜ pending |
| R2 | ID generation ordering not deterministic → IDs change if re-run | Medium | ORDER BY subgroups.created_at ASC, trees.posicion ASC + lock after generation | ⬜ pending |
| R3 | SheetJS needs `type: 'base64'` in React Native (not buffer) | Low | Documented in research, covered by test | ⬜ pending |
| R4 | Technician list requires server connectivity | Medium | Show clear error if offline | ⬜ pending |
| R5 | Drag-and-drop may need additional library (react-native-draggable-flatlist) | Medium | Research recommended arrows to avoid this — user overrode | ⬜ pending |

### Dependencies

| # | Dependency | Source | Status |
|---|-----------|--------|--------|
| D1 | plantation_users table in local SQLite | Phase 3 | ✅ exists |
| D2 | SyncService.pullFromServer | Phase 3 | ✅ exists |
| D3 | ConfirmModal + useConfirm | Phase 3 | ✅ exists |
| D4 | trees.plantacionId and trees.globalId columns (integer, nullable) | Phase 1 schema | ✅ exists |
| D5 | `xlsx` npm package | New install required | ⬜ pending |
| D6 | `expo-sharing` npm package | New install required | ⬜ pending |
| D7 | Drag-and-drop library (react-native-draggable-flatlist or similar) | New install required | ⬜ pending |

---

## Post-Implementation Resolution

> Fill this section after Phase 4 execution completes.

### Resolved Assumptions

| # | Resolution | Notes |
|---|-----------|-------|
| | | |

### New Assumptions Discovered During Implementation

| # | Assumption | How Resolved |
|---|-----------|-------------|
| | | |

### Deviations from Plan

| # | Planned | Actual | Reason |
|---|---------|--------|--------|
| | | | |

---

*Phase: 04-admin-export*
*Created: 2026-03-20*
*Last updated: 2026-03-20 (pre-implementation)*
