---
phase: 5
slug: ux-improvements
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-28
updated: 2026-04-13
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest-expo ~54.0.17 |
| **Config file** | package.json (jest config section) |
| **Quick run command** | `npm test -- --watchAll=false` |
| **Full suite command** | `npm test -- --watchAll=false --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --watchAll=false`
- **After every plan wave:** Run `npm test -- --watchAll=false --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | UX-CONN | unit | `cd mobile && npx jest tests/hooks/useNetStatus.test.ts` | ✅ | ✅ green |
| 05-01-02 | 01 | 1 | UX-PROF | unit | `cd mobile && npx jest tests/hooks/useProfileData.test.ts` | ✅ | ✅ green |
| 05-02-01 | 02 | 2 | UX-FRESH | unit | `cd mobile && npx jest tests/queries/freshnessQueries.test.ts` | ✅ | ✅ green |
| 05-02-02 | 02 | 2 | UX-HEAD | manual | visual | N/A | ⬜ manual |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `mobile/tests/hooks/useNetStatus.test.ts` — connectivity hook tests
- [x] `mobile/tests/hooks/useProfileData.test.ts` — profile data hook tests
- [x] `mobile/tests/queries/freshnessQueries.test.ts` — freshness query tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Online/offline icon changes color | UX-CONN | Visual feedback | Toggle airplane mode, verify icon transitions |
| Freshness banner appears | UX-FRESH | Server-dependent | Load stale data, connect, verify banner appears |
| Profile screen shows data | UX-PROF | Supabase-dependent | Login, navigate to profile, verify name/email/org |
| Header shows contextual title | UX-HEAD | Role-dependent | Login as admin vs tecnico, compare header titles |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 complete
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** green — 302 tests passing (2026-04-13)
