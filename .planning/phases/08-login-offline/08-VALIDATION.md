---
phase: 8
slug: login-offline
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-13
updated: 2026-04-13
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (jest-expo) |
| **Config file** | `mobile/jest.config.js` |
| **Quick run command** | `cd mobile && npx jest tests/auth/offlineAuth.test.ts tests/hooks/useAuth.test.ts` |
| **Full suite command** | `cd mobile && npx jest --passWithNoTests` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | OFFL-01 cacheCredential | unit | `cd mobile && npx jest tests/auth/offlineAuth.test.ts` | ✅ | ✅ green |
| 08-01-02 | 01 | 1 | OFFL-02 salted SHA-256 hash | unit | `cd mobile && npx jest tests/auth/offlineAuth.test.ts` | ✅ | ✅ green |
| 08-01-03 | 01 | 1 | OFFL-03 verifyCredential | unit | `cd mobile && npx jest tests/auth/offlineAuth.test.ts` | ✅ | ✅ green |
| 08-01-04 | 01 | 1 | OFFL-04 clearCredential | unit | `cd mobile && npx jest tests/auth/offlineAuth.test.ts` | ✅ | ✅ green |
| 08-01-05 | 01 | 1 | OFFL-05 getCachedEmails | unit | `cd mobile && npx jest tests/auth/offlineAuth.test.ts` | ✅ | ✅ green |
| 08-01-06 | 01 | 1 | OFFL-06 lazy migration | unit | `cd mobile && npx jest tests/auth/offlineAuth.test.ts` | ✅ | ✅ green |
| 08-01-07 | 01 | 1 | OFFL-07 no plaintext storage | unit | `cd mobile && npx jest tests/auth/offlineAuth.test.ts` | ✅ | ✅ green |
| 08-02-01 | 02 | 2 | OFFL-01 online signIn caches | unit | `cd mobile && npx jest tests/hooks/useAuth.test.ts` | ✅ | ✅ green |
| 08-02-02 | 02 | 2 | OFFL-03 offline signIn verifies | unit | `cd mobile && npx jest tests/hooks/useAuth.test.ts` | ✅ | ✅ green |
| 08-02-03 | 02 | 2 | OFFL-05 signOut clears current user | unit | `cd mobile && npx jest tests/hooks/useAuth.test.ts` | ✅ | ✅ green |
| 08-02-04 | 02 | 2 | Login screen chips | manual | visual UI | N/A | ⬜ manual |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `mobile/tests/auth/offlineAuth.test.ts` — 9 unit tests for OfflineAuthService (OFFL-01 through OFFL-07)
- [x] `mobile/tests/hooks/useAuth.test.ts` — connectivity-aware signIn/signOut tests
- [x] `mobile/tests/setup.ts` — expo-crypto mock with digestStringAsync and getRandomBytes

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Email chips appear on login screen | OFFL-05 | Visual UI — requires logged-in device state | Login successfully, logout, verify email chips appear on login screen |
| Offline login with cached credentials | OFFL-03 | Requires airplane mode toggle | Login online, enable airplane mode, logout, try login with same credentials |
| Spanish error for offline without cache | OFFL-07 | Requires offline state with no cache | Fresh install, enable airplane mode, attempt login — verify Spanish error message |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 complete
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** green — 302 tests passing (2026-04-13)
