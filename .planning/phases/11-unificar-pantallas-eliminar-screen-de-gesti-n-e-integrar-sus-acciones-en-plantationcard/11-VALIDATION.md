---
phase: 11
slug: unificar-pantallas-eliminar-screen-de-gesti-n-e-integrar-sus-acciones-en-plantationcard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
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
| 11-01-01 | 01 | 1 | TBD | unit | `npx jest --passWithNoTests` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for hook refactor (usePlantationAdmin accordion removal)
- [ ] Test stubs for PlantationCard sidebar strip rendering
- [ ] Test stubs for AdminBottomSheet component

*If none: "Existing infrastructure covers all phase requirements."*

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
