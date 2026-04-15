---
phase: 4
slug: admin-export
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-19
updated: 2026-04-13
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest-expo (jest-expo ~52.0.0) |
| **Config file** | `mobile/jest.config.js` |
| **Quick run command** | `cd mobile && npx jest tests/queries/adminQueries.test.ts tests/repositories/PlantationRepository.test.ts tests/services/exportService.test.ts -x` |
| **Full suite command** | `cd mobile && npx jest --testEnvironment node` |
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
| 04-01-01 | 01 | 1 | PLAN-01 | unit | `cd mobile && npx jest tests/admin/PlantationRepository.test.ts` | ✅ | ✅ green |
| 04-01-02 | 01 | 1 | PLAN-02, PLAN-04, PLAN-05 | unit | `cd mobile && npx jest tests/admin/PlantationRepository.test.ts` | ✅ | ✅ green |
| 04-01-03 | 01 | 1 | PLAN-03 | unit | `cd mobile && npx jest tests/admin/PlantationRepository.test.ts` | ✅ | ✅ green |
| 04-01-04 | 01 | 1 | PLAN-06 | unit | `cd mobile && npx jest tests/admin/adminQueries.test.ts` | ✅ | ✅ green |
| 04-02-01 | 02 | 2 | IDGN-01, IDGN-02, IDGN-03 | unit | `cd mobile && npx jest tests/admin/PlantationRepository.test.ts` | ✅ | ✅ green |
| 04-02-02 | 02 | 2 | IDGN-04 | unit | `cd mobile && npx jest tests/admin/adminQueries.test.ts` | ✅ | ✅ green |
| 04-03-01 | 03 | 2 | EXPO-01, EXPO-02, EXPO-03 | unit | `cd mobile && npx jest tests/admin/ExportService.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `mobile/tests/admin/PlantationRepository.test.ts` — covers PLAN-01 through PLAN-06, IDGN-01 through IDGN-03
- [x] `mobile/tests/admin/adminQueries.test.ts` — covers PLAN-06, IDGN-04
- [x] `mobile/tests/admin/ExportService.test.ts` — covers EXPO-01, EXPO-02, EXPO-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Species reorder drag/arrows | PLAN-05 | Visual interaction | Reorder species, verify grid order changes |
| Share sheet opens with file | EXPO-01/02 | OS integration | Export → verify share sheet shows file |
| Admin screens navigation | PLAN-01-06 | Visual layout | Navigate create → configure → assign → finalize flow |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 complete
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** green — 302 tests passing (2026-04-13)
