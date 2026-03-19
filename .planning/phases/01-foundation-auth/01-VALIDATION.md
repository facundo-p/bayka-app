---
phase: 1
slug: foundation-auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (jest-expo) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx jest --passWithNoTests` |
| **Full suite command** | `npx jest --coverage --passWithNoTests` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --passWithNoTests`
- **After every plan wave:** Run `npx jest --coverage --passWithNoTests`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | FOUN-01 | smoke | `npx expo doctor` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | FOUN-05 | integration | `npx supabase db test` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | FOUN-04 | seed verify | `npx supabase db reset && check` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | AUTH-01 | integration | `npx jest --testPathPattern=auth` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 2 | AUTH-02 | unit | `npx jest --testPathPattern=session` | ❌ W0 | ⬜ pending |
| 01-03-03 | 03 | 2 | AUTH-04 | unit | `npx jest --testPathPattern=role` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `jest.config.js` — jest-expo configuration
- [ ] `mobile/src/__tests__/setup.ts` — test setup and mocks
- [ ] `jest-expo` + `@testing-library/react-native` — install testing dependencies

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App opens offline after first login | AUTH-02 | Requires physical airplane mode toggle | 1. Login with connectivity 2. Enable airplane mode 3. Force close app 4. Reopen — should show dashboard |
| Different user login on same device | AUTH-05 | Requires sequential manual login flows | 1. Login as admin 2. Logout 3. Login as tecnico 4. Verify different navigation |
| SQLite schema initializes on first launch | FOUN-02 | Requires fresh app install | 1. Clear app data 2. Open app 3. Verify "Inicializando..." splash 4. Verify tables created |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
