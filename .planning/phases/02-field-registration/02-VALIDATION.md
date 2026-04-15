---
phase: 2
slug: field-registration
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-17
updated: 2026-04-13
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (jest-expo) |
| **Config file** | mobile/jest.config.js |
| **Quick run command** | `npx jest --passWithNoTests` |
| **Full suite command** | `npx jest --coverage --passWithNoTests` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --passWithNoTests`
- **After every plan wave:** Run `npx jest --coverage --passWithNoTests`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Wave 0 Requirements

- [x] `expo-image-picker` + `expo-file-system` installed
- [x] Demo plantation seeded in local SQLite for end-to-end testing
- [x] `plantation_species` junction table added to Drizzle schema
- [x] SubGroup unique index `(plantacion_id, codigo)` added to schema

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-tree-reg | 01-04 | 1-2 | TREE-01-06 | integration | `cd mobile && npx jest tests/hooks/useTreeRegistration.test.ts tests/repositories/PlantationSpeciesRepository.test.ts tests/repositories/TreeRepository.test.ts` | ✅ | ✅ green |
| 02-subgroup | 02-03 | 1 | SUBG-01-03 | integration | `cd mobile && npx jest tests/database/subgroup.test.ts tests/database/tree.test.ts` | ✅ | ✅ green |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Species grid is usable with gloves | TREE-01 | Physical interaction | Test on device outdoors with work gloves |
| Camera opens for N/N photo | NN-02 | Requires device camera | Tap N/N button, verify camera launches |
| Photo from gallery attaches | TREE-06 | Requires device gallery | Tap photo icon on any tree, pick from gallery |
| Button tap feedback visible in sunlight | TREE-02 | Requires outdoor testing | Test with screen brightness on max outdoors |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 complete
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** green — 302 tests passing (2026-04-13)
