---
phase: 5
slug: ux-improvements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
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
| 05-01-01 | 01 | 1 | UX-CONN | unit | `npm test -- useNetStatus` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | UX-PROF | unit | `npm test -- useProfileData` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | UX-FRESH | unit | `npm test -- freshnessCheck` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | UX-HEAD | manual | visual | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/hooks/__tests__/useNetStatus.test.ts` — stubs for connectivity hook
- [ ] `src/hooks/__tests__/useProfileData.test.ts` — stubs for profile data hook

*Existing test infrastructure covers framework setup.*

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
