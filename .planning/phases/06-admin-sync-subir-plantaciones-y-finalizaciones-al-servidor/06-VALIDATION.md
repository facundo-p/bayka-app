---
phase: 6
slug: admin-sync-subir-plantaciones-y-finalizaciones-al-servidor
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-31
updated: 2026-04-13
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | `mobile/jest.config.js` |
| **Quick run command** | `cd mobile && npx jest --testPathPattern=phase06 --no-coverage` |
| **Full suite command** | `cd mobile && npx jest --no-coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd mobile && npx jest --testPathPattern=phase06 --no-coverage`
- **After every plan wave:** Run `cd mobile && npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | Catalog query | unit | `cd mobile && npx jest tests/queries/catalogQueries.test.ts` | ✅ | ✅ green |
| 06-01-02 | 01 | 1 | Download service | unit | `cd mobile && npx jest tests/sync/downloadService.test.ts` | ✅ | ✅ green |
| 06-02-01 | 02 | 2 | Catalog screen | manual | visual UI | N/A | ⬜ manual |
| 06-02-02 | 02 | 2 | Header icon nav | manual | visual UI | N/A | ⬜ manual |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `mobile/tests/queries/catalogQueries.test.ts` — server catalog query tests
- [x] `mobile/tests/sync/downloadService.test.ts` — download orchestration tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Modal progress bar during download | D-08 | Visual UI behavior | Open catalog, select plantations, tap download, verify modal shows with progress |
| Connectivity icon tap opens catalog | D-02 | Navigation + visual | Verify online icon is tappable, navigates to catalog; verify offline icon is disabled |
| Already-downloaded indicator | D-05 | Visual distinction | Download a plantation, reopen catalog, verify it shows as downloaded and is not selectable |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 complete
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** green — 302 tests passing (2026-04-13)
