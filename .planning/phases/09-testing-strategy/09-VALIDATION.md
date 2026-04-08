---
phase: 9
slug: testing-strategy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
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
| TBD | 01 | 1 | D-01/D-02 | lint+type | `cd mobile && npx tsc --noEmit` | ✅ | ⬜ pending |
| TBD | 02 | 2 | D-03/D-05 | integration | `cd mobile && npx jest --config jest.integration.config.js` | ❌ W0 | ⬜ pending |
| TBD | 03 | 2 | D-06 | e2e | `maestro test maestro/` | ❌ W0 | ⬜ pending |
| TBD | 04 | 3 | D-12/D-13 | ci | `gh workflow run ci.yml` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `mobile/jest.integration.config.js` — separate config for integration tests with real SQLite
- [ ] `better-sqlite3` dev dependency installed
- [ ] `mobile/tests/helpers/factories.ts` — test data factory functions
- [ ] `mobile/tests/helpers/networkHelper.ts` — centralized offline simulation
- [ ] Fix 3 failing test suites (offlineAuth, seed, useProfileData)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Maestro E2E on device | D-06 | Requires simulator/device | Run `maestro test` locally with iOS simulator |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
