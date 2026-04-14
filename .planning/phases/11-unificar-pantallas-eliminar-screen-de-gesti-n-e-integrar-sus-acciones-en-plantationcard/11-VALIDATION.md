---
phase: 11
slug: unificar-pantallas-eliminar-screen-de-gesti-n-e-integrar-sus-acciones-en-plantationcard
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-11
updated: 2026-04-13
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | `jest.config.js` or "none — Wave 0 installs" |
| **Quick run command** | `npx jest --passWithNoTests` |
| **Full suite command** | `npx jest --passWithNoTests --coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --passWithNoTests`
- **After every plan wave:** Run `npx jest --passWithNoTests --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | hook refactor usePlantationAdmin | unit | `cd mobile && npx jest tests/hooks/usePlantationAdmin.test.ts` | ✅ | ✅ green |
| 11-02-01 | 02 | 1 | AdminBottomSheet component | unit | `cd mobile && npx jest tests/components/AdminBottomSheet.test.tsx` | ✅ | ✅ green |
| 11-03-01 | 03 | 2 | PlantationCard refactor regression | unit | `cd mobile && npx jest tests/screens/refactor-regression.test.ts tests/components/PlantationCard.test.tsx` | ✅ | ✅ green |
| 11-UI-01 | 01-03 | 2 | Bottom sheet opens on gear tap | manual | Touch interaction | N/A | ⬜ manual |
| 11-UI-02 | 01-03 | 2 | Gear icon hidden for tecnico | manual | Role-based UI | N/A | ⬜ manual |
| 11-UI-03 | 01-03 | 2 | Gestión tab removed | manual | Navigation structure | N/A | ⬜ manual |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `mobile/tests/hooks/usePlantationAdmin.test.ts` — hook refactor tests
- [x] `mobile/tests/components/AdminBottomSheet.test.tsx` — bottom sheet component tests
- [x] `mobile/tests/components/PlantationCard.test.tsx` — card rendering tests
- [x] `mobile/tests/screens/refactor-regression.test.ts` — regression tests for screen refactor

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bottom sheet opens on gear tap | TBD | Touch interaction | Tap gear icon on admin card, verify sheet slides up with all options |
| Edit icon opens edit modal | TBD | Touch interaction | Tap edit icon on any card, verify lugar/periodo edit modal opens |
| Gear icon hidden for tecnico | TBD | Role-based UI | Login as tecnico, verify no gear icon visible on cards |
| Navigation tab removed | TBD | Navigation structure | Verify admin tabs show only Plantaciones (no Gestión tab) |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 complete
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** green — 302 tests passing (2026-04-13)
