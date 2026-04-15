---
phase: 13
slug: unificar-sync-bidireccional
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-13
updated: 2026-04-13
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | mobile/jest.config.js |
| **Quick run command** | `cd mobile && npx jest --testPathPattern` |
| **Full suite command** | `cd mobile && npx jest` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd mobile && npx jest --testPathPattern`
- **After every plan wave:** Run `cd mobile && npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | D-11 pendingSync schema flag | unit | `cd mobile && npx jest tests/database/subgroup.test.ts tests/database/tree.test.ts` | ✅ | ✅ green |
| 13-01-02 | 01 | 1 | D-05 SubGroupRepository pendingSync | unit | `cd mobile && npx jest tests/admin/adminQueries.test.ts tests/hooks/usePlantationAdmin.test.ts` | ✅ | ✅ green |
| 13-02-01 | 02 | 1 | D-01 single Sincronizar button | manual | Visual: single button replaces two | N/A | ⬜ manual |
| 13-02-02 | 02 | 1 | D-04 useSyncSetting persistence | unit | `cd mobile && npx jest tests/hooks/useSync.test.ts` | ✅ | ✅ green |
| 13-02-03 | 02 | 1 | D-02 bidirectional sync orchestration | unit | `cd mobile && npx jest tests/sync/SyncService.test.ts tests/sync/SyncService.offline.test.ts` | ✅ | ✅ green |
| 13-03-01 | 03 | 2 | D-08 syncPending color in theme | unit | `cd mobile && npx jest tests/components/AdminBottomSheet.test.tsx tests/components/PlantationCard.test.tsx` | ✅ | ✅ green |
| 13-03-02 | 03 | 2 | D-09 orange dot on cards | manual | Visual: orange dot indicator | N/A | ⬜ manual |
| 13-03-03 | 03 | 2 | D-07 sincronizada estado removed | unit | `cd mobile && npx jest tests/components/AdminBottomSheet.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Existing infrastructure covers all phase requirements
- [x] Tests updated in: subgroup.test.ts, tree.test.ts, adminQueries.test.ts, usePlantationAdmin.test.ts, dashboard.test.ts, SyncService.test.ts, useSync.test.ts, AdminBottomSheet.test.tsx

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Single "Sincronizar" button replaces two buttons | D-01 | UI layout verification | Open PlantacionesScreen, verify single sync button in header and bottom sheet |
| Orange dot appears on cards with pending sync | D-08, D-09 | Visual indicator | Create local change, verify orange dot on PlantationCard and SubGroupCard |
| Sync pull+push executes bidirectionally | D-01 | Requires Supabase server | Trigger sync, verify pull then push completes |
| Photo setting persists across app restarts | D-04 | Persistence check | Toggle setting, kill app, reopen, verify setting retained |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 complete
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** green — 302 tests passing (2026-04-13)
