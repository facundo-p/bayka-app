---
phase: 9
slug: testing-strategy
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-08
updated: 2026-04-13
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (jest-expo preset) |
| **Config file** | `mobile/jest.config.js` |
| **Quick run command** | `cd mobile && npx jest --bail --passWithNoTests` |
| **Full suite command** | `cd mobile && npx jest --forceExit` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd mobile && npx jest --bail --passWithNoTests`
- **After every plan wave:** Run `cd mobile && npx jest --forceExit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01 | 01 | 1 | D-01/D-02 TypeScript coverage | lint+type | `cd mobile && npx tsc --noEmit` | ✅ | ✅ green |
| 09-02 | 02 | 2 | D-03/D-05 integration tests | integration | `cd mobile && npx jest tests/integration/` | ✅ | ✅ green |
| 09-03 | 03 | 2 | D-06 e2e | e2e | `maestro test maestro/` | ❌ manual | ⬜ manual |
| 09-04 | 04-09 | 3 | D-12/D-13 full suite 302 tests | unit+integration | `cd mobile && npx jest --passWithNoTests` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] jest infrastructure fully established in `mobile/jest.config.js`
- [x] `mobile/tests/helpers/` — test helpers and factory functions
- [x] `mobile/tests/integration/` — 6 integration test suites
- [x] 39 test suites, 302 tests, all passing

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Maestro E2E on device | D-06 | Requires simulator/device | Run `maestro test` locally with iOS simulator |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 complete
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** green — 302 tests passing (2026-04-13)
