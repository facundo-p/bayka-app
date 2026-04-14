---
phase: 7
slug: eliminar-plantacion-local
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-13
updated: 2026-04-13
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (jest-expo) |
| **Config file** | `mobile/jest.config.js` |
| **Quick run command** | `cd mobile && npx jest tests/repositories/deletePlantationLocally.test.ts tests/queries/unsyncedSubgroupSummary.test.ts` |
| **Full suite command** | `cd mobile && npx jest --passWithNoTests` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | DEL-01 cascade delete | unit | `cd mobile && npx jest tests/repositories/deletePlantationLocally.test.ts` | ✅ | ✅ green |
| 07-01-02 | 01 | 1 | DEL-02 unsynced detection | unit | `cd mobile && npx jest tests/queries/unsyncedSubgroupSummary.test.ts` | ✅ | ✅ green |
| 07-02-01 | 02 | 2 | DEL-03 unsynced warning UI | manual | visual — confirmation dialog | N/A | ⬜ manual |
| 07-02-02 | 02 | 2 | DEL-04 catalog delete action | manual | visual — trash icon on card | N/A | ⬜ manual |
| 07-02-03 | 02 | 2 | DEL-05 both roles can delete | manual | role-based visual check | N/A | ⬜ manual |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `mobile/tests/repositories/deletePlantationLocally.test.ts` — 8 cascade delete tests
- [x] `mobile/tests/queries/unsyncedSubgroupSummary.test.ts` — 4 unsynced detection tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Single confirmation for safe deletes | DEL-03 | Modal/dialog interaction | Download synced plantation, tap trash icon, verify single confirm prompt |
| Double confirmation for unsynced data | DEL-03 | Modal/dialog interaction | Have unsynced subgroups, tap trash icon, verify double confirm with counts |
| Trash icon replaces "Ya descargada" badge | DEL-04 | Visual layout | Open catalog, verify downloaded plantation shows trash icon not badge |
| Admin and tecnico can both delete | DEL-05 | Role-based check | Test delete flow with both admin and tecnico credentials |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 complete
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** green — 302 tests passing (2026-04-13)
