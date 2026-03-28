---
phase: 3
slug: sync-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (jest-expo preset) |
| **Config file** | `mobile/jest.config.js` |
| **Quick run command** | `cd mobile && npx jest tests/sync/ --testEnvironment node` |
| **Full suite command** | `cd mobile && npx jest --testEnvironment node` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd mobile && npx jest tests/sync/ --testEnvironment node`
- **After every plan wave:** Run `cd mobile && npx jest --testEnvironment node`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | SYNC-02 | unit | `npx jest tests/sync/SyncService.test.ts -t "atomic upload"` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | SYNC-03 | unit | `npx jest tests/sync/SyncService.test.ts -t "DUPLICATE_CODE"` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | SYNC-01 | unit | `npx jest tests/sync/SyncService.test.ts -t "only finalizada"` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | SYNC-04 | unit | `npx jest tests/sync/SyncService.test.ts -t "Spanish error"` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | SYNC-05 | unit | `npx jest tests/sync/SyncService.test.ts -t "markAsSincronizada"` | ❌ W0 | ⬜ pending |
| 03-02-04 | 02 | 1 | SYNC-06 | unit | `npx jest tests/sync/SyncService.test.ts -t "pull before push"` | ❌ W0 | ⬜ pending |
| 03-02-05 | 02 | 1 | SYNC-07 | unit | `npx jest tests/sync/SyncService.test.ts -t "pending count"` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | DASH-01 | unit | `npx jest tests/sync/dashboard.test.ts -t "tecnico filter"` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | DASH-02 | unit | `npx jest tests/sync/dashboard.test.ts -t "admin all"` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03 | 2 | DASH-03 | unit | `npx jest tests/sync/dashboard.test.ts -t "total trees"` | ❌ W0 | ⬜ pending |
| 03-03-04 | 03 | 2 | DASH-04 | unit | `npx jest tests/sync/dashboard.test.ts -t "unsynced count"` | ❌ W0 | ⬜ pending |
| 03-03-05 | 03 | 2 | DASH-05 | unit | `npx jest tests/sync/dashboard.test.ts -t "user total"` | ❌ W0 | ⬜ pending |
| 03-03-06 | 03 | 2 | DASH-06 | unit | `npx jest tests/sync/dashboard.test.ts -t "today count"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `mobile/tests/sync/SyncService.test.ts` — stubs for SYNC-01 through SYNC-07
- [ ] `mobile/tests/sync/dashboard.test.ts` — stubs for DASH-01 through DASH-06
- [ ] Mock for `mobile/src/supabase/client.ts` in test files — `jest.mock('../../src/supabase/client')`

*Wave 0 creates test stubs with mock infrastructure before implementation begins.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sync modal blocks user interaction | SYNC-01 | RN Modal overlay is visual | Tap sync → verify screen is non-interactive |
| Badge appears on Plantaciones tab | SYNC-07 | Tab icon badge is visual | Finalize SubGroup → verify badge count appears |
| Plantation card shows stats | DASH-03-06 | Visual layout verification | Navigate to Plantaciones → verify stats render |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
