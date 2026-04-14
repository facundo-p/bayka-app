---
phase: 1
slug: foundation-auth
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-16
updated: 2026-04-13
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
| 01-01-01 | 01 | 1 | FOUN-01 | smoke | `npx expo doctor` | manual | ⬜ manual |
| 01-02-01 | 02 | 1 | FOUN-05 | integration | `cd mobile && npx jest tests/database/migrations.test.ts tests/database/seed.test.ts` | ✅ | ✅ green |
| 01-02-02 | 02 | 1 | FOUN-04 | seed verify | `cd mobile && npx jest tests/database/seed.test.ts` | ✅ | ✅ green |
| 01-03-01 | 03 | 2 | AUTH-01 | integration | `cd mobile && npx jest tests/auth/` | ✅ | ✅ green |
| 01-03-02 | 03 | 2 | AUTH-02 | unit | `cd mobile && npx jest tests/auth/session.test.ts` | ✅ | ✅ green |
| 01-03-03 | 03 | 2 | AUTH-04 | unit | `cd mobile && npx jest tests/auth/role.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `jest.config.js` — jest-expo configuration (installed)
- [x] `mobile/tests/setup.ts` — test setup and mocks (installed)
- [x] `jest-expo` + `@testing-library/react-native` — installed

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

- [x] All tasks have automated verify or manual justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 complete
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** green — 302 tests passing (2026-04-13)
