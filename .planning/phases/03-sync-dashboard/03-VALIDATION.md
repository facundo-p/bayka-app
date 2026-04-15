---
phase: 3
slug: sync-dashboard
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-19
updated: 2026-04-13
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
| 03-01-01 | 01 | 1 | SYNC-02 | unit | `cd mobile && npx jest tests/sync/SyncService.test.ts` | ✅ | ✅ green |
| 03-01-02 | 01 | 1 | SYNC-03 | unit | `cd mobile && npx jest tests/sync/SyncService.test.ts` | ✅ | ✅ green |
| 03-02-01 | 02 | 1 | SYNC-01 | unit | `cd mobile && npx jest tests/sync/SyncService.test.ts` | ✅ | ✅ green |
| 03-02-02 | 02 | 1 | SYNC-04 | unit | `cd mobile && npx jest tests/sync/SyncService.test.ts` | ✅ | ✅ green |
| 03-02-03 | 02 | 1 | SYNC-05 | unit | `cd mobile && npx jest tests/sync/SyncService.test.ts` | ✅ | ✅ green |
| 03-02-04 | 02 | 1 | SYNC-06 | unit | `cd mobile && npx jest tests/sync/SyncService.offline.test.ts` | ✅ | ✅ green |
| 03-02-05 | 02 | 1 | SYNC-07 | unit | `cd mobile && npx jest tests/queries/unsyncedSubgroupSummary.test.ts` | ✅ | ✅ green |
| 03-03-01 | 03 | 2 | DASH-01 | unit | `cd mobile && npx jest tests/sync/dashboard.test.ts` | ✅ | ✅ green |
| 03-03-02 | 03 | 2 | DASH-02 | unit | `cd mobile && npx jest tests/sync/dashboard.test.ts` | ✅ | ✅ green |
| 03-03-03 | 03 | 2 | DASH-03 | unit | `cd mobile && npx jest tests/sync/dashboard.test.ts` | ✅ | ✅ green |
| 03-03-04 | 03 | 2 | DASH-04 | unit | `cd mobile && npx jest tests/sync/dashboard.test.ts` | ✅ | ✅ green |
| 03-03-05 | 03 | 2 | DASH-05 | unit | `cd mobile && npx jest tests/sync/dashboard.test.ts` | ✅ | ✅ green |
| 03-03-06 | 03 | 2 | DASH-06 | unit | `cd mobile && npx jest tests/sync/dashboard.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `mobile/tests/sync/SyncService.test.ts` — exists with full coverage
- [x] `mobile/tests/sync/dashboard.test.ts` — exists with full coverage
- [x] Mock for `mobile/src/supabase/client.ts` in test files

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sync modal blocks user interaction | SYNC-01 | RN Modal overlay is visual | Tap sync → verify screen is non-interactive |
| Badge appears on Plantaciones tab | SYNC-07 | Tab icon badge is visual | Finalize SubGroup → verify badge count appears |
| Plantation card shows stats | DASH-03-06 | Visual layout verification | Navigate to Plantaciones → verify stats render |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 complete
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** green — 302 tests passing (2026-04-13)
