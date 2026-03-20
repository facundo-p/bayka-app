---
phase: 4
slug: admin-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
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
| 04-01-01 | 01 | 1 | PLAN-01 | unit | `npx jest tests/repositories/PlantationRepository.test.ts -t "PLAN-01"` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | PLAN-02, PLAN-04, PLAN-05 | unit | `npx jest tests/repositories/PlantationRepository.test.ts -t "PLAN-02"` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | PLAN-03 | unit | `npx jest tests/repositories/PlantationRepository.test.ts -t "PLAN-03"` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | PLAN-06 | unit | `npx jest tests/queries/adminQueries.test.ts -t "PLAN-06"` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | IDGN-01, IDGN-02, IDGN-03 | unit | `npx jest tests/repositories/PlantationRepository.test.ts -t "IDGN"` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | IDGN-04 | unit | `npx jest tests/queries/adminQueries.test.ts -t "IDGN-04"` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | EXPO-01, EXPO-02, EXPO-03 | unit | `npx jest tests/services/exportService.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `mobile/tests/repositories/PlantationRepository.test.ts` — covers PLAN-01 through PLAN-06, IDGN-01 through IDGN-03
- [ ] `mobile/tests/queries/adminQueries.test.ts` — covers PLAN-06, IDGN-04
- [ ] `mobile/tests/services/exportService.test.ts` — covers EXPO-01, EXPO-02, EXPO-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Species reorder drag/arrows | PLAN-05 | Visual interaction | Reorder species, verify grid order changes |
| Share sheet opens with file | EXPO-01/02 | OS integration | Export → verify share sheet shows file |
| Admin screens navigation | PLAN-01-06 | Visual layout | Navigate create → configure → assign → finalize flow |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
