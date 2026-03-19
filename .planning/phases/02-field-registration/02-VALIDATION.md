---
phase: 2
slug: field-registration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
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

- [ ] `expo-image-picker` + `expo-file-system` installed
- [ ] Demo plantation seeded in local SQLite for end-to-end testing
- [ ] `plantation_species` junction table added to Drizzle schema
- [ ] SubGroup unique index `(plantacion_id, codigo)` added to schema

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
