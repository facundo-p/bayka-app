---
phase: 14
slug: sincronizar-subgrupos-finalizados-con-n-ns-resolver-n-ns-blo
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-14
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | mobile/jest.config.js |
| **Quick run command** | `cd mobile && npx jest --passWithNoTests` |
| **Full suite command** | `cd mobile && npx jest --passWithNoTests` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd mobile && npx jest --passWithNoTests`
- **After every plan wave:** Run `cd mobile && npx jest --passWithNoTests`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-T1 | 14-01 | 1 | D-01, D-03, D-09 | T-14-01, T-14-03 | RPC DO UPDATE limited to species_id+sub_id; conflict columns local-only | grep-verify | `grep -q "conflict_especie_id" mobile/drizzle/0010_add_tree_conflict_columns.sql && grep -q "0010_add_tree_conflict_columns" mobile/drizzle/meta/_journal.json && grep -q "m0010" mobile/drizzle/migrations.js && grep -q "conflictEspecieId" mobile/src/database/schema.ts && grep -q "DO UPDATE" supabase/migrations/009_sync_subgroup_update_trees.sql && echo "PASS" \|\| echo "FAIL"` | N/A (new files) | ⬜ pending |
| 14-01-T2 | 14-01 | 1 | D-01, D-04, D-06, D-07, D-12 | T-14-02 | getSyncableSubGroups userId filter preserved | grep-verify | `grep -q "pendingSync, true" mobile/src/repositories/SubGroupRepository.ts && grep -q "unresolvedNNCount" mobile/src/queries/adminQueries.ts && grep -q "getUnresolvedNNCountsPerPlantation" mobile/src/queries/dashboardQueries.ts && grep -q "getNNTreesForPlantationByUser" mobile/src/queries/plantationDetailQueries.ts && echo "PASS" \|\| echo "FAIL"` | yes | ⬜ pending |
| 14-02-T1 | 14-02 | 2 | D-02, D-10, D-04, D-12 | T-14-04, T-14-05 | Conflict detection skip preserves local data | grep-verify | `grep -q "conflictEspecieId" mobile/src/services/SyncService.ts && grep -q "unresolvedNNCount" mobile/src/hooks/usePlantationAdmin.ts && grep -q "nnCountMap" mobile/src/hooks/usePlantaciones.ts && echo "PASS" \|\| echo "FAIL"` | yes | ⬜ pending |
| 14-02-T2 | 14-02 | 2 | D-07, D-10 | T-14-04, T-14-06 | canResolve gated by role; acceptServerResolution uses resolveNNTree audit | grep-verify | `grep -q "getNNTreesForPlantationByUser" mobile/src/hooks/useNNResolution.ts && grep -q "canResolve" mobile/src/hooks/useNNResolution.ts && grep -q "acceptServerResolution" mobile/src/hooks/useNNResolution.ts && grep -q "conflictEspecieId" mobile/src/queries/plantationDetailQueries.ts && echo "PASS" \|\| echo "FAIL"` | yes | ⬜ pending |
| 14-03-T1 | 14-03 | 3 | D-05, D-08, D-11, D-12 | T-14-07, T-14-09 | N/N gate informational; UI role from authenticated profile | grep-verify | `grep -q "nnCount" mobile/src/components/PlantationCard.tsx && grep -q "hasUnresolvedNN" mobile/src/components/AdminBottomSheet.tsx && grep -q "nnCountMap" mobile/src/screens/PlantacionesScreen.tsx && echo "PASS" \|\| echo "FAIL"` | yes | ⬜ pending |
| 14-03-T2 | 14-03 | 3 | D-10, D-11 | T-14-07, T-14-08 | canResolve from authenticated user; species names are catalog data | grep-verify | `grep -q "conflictBanner" mobile/src/screens/NNResolutionScreen.tsx && grep -q "acceptServerResolution" mobile/src/screens/NNResolutionScreen.tsx && grep -q "nnBadge" mobile/src/screens/PlantationDetailScreen.tsx && echo "PASS" \|\| echo "FAIL"` | yes | ⬜ pending |
| 14-03-T3 | 14-03 | 3 | D-05, D-10, D-11, D-12 | — | N/A (human verify) | checkpoint | Human confirms 10 verification steps | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*No Wave 0 test scaffolding required. All tasks use grep-verify commands that check for expected code patterns in modified files. No MISSING test references exist in any plan.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sync N/N trees to server | D-01/D-03 | Requires live Supabase RPC | Finalize subgroup with N/N, sync, verify server has null species_id |
| Conflict detection | D-10 | Requires two concurrent users | Resolve same N/N from two devices, sync both, verify conflict shown |
| Finalization gate | D-04/D-05 | UI interaction | Try finalizing plantation with N/N, verify button disabled |

*These behaviors require manual testing with a real device/emulator.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
