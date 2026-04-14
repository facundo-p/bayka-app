---
phase: 10
slug: creaci-n-de-plantaci-n-offline-sync-cat-logo-de-especies
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-08
updated: 2026-04-13
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | jest.config.js |
| **Quick run command** | `npx jest --testPathPattern="phase10" --bail` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern="phase10" --bail`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | offline plantation creation | unit | `cd mobile && npx jest tests/admin/PlantationRepository.offline.test.ts` | ✅ | ✅ green |
| 10-01-02 | 01 | 1 | species catalog sync | unit | `cd mobile && npx jest tests/sync/SyncService.offline.test.ts` | ✅ | ✅ green |
| 10-02-01 | 02 | 2 | offline plantation UI flow | manual | visual — requires device interaction | N/A | ⬜ manual |
| 10-02-02 | 02 | 2 | sync after reconnection | manual | requires network toggle on device | N/A | ⬜ manual |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `mobile/tests/admin/PlantationRepository.offline.test.ts` — offline plantation creation tests
- [x] `mobile/tests/sync/SyncService.offline.test.ts` — species catalog sync and offline upload tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Offline plantation creation UI flow | TBD | Requires device interaction | Create plantation while airplane mode is on, verify it appears in list |
| Sync after reconnection | TBD | Requires network toggle | Create offline, enable network, trigger sync, verify on server |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 complete
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** green — 302 tests passing (2026-04-13)
