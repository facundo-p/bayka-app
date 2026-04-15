---
phase: 12
slug: persistir-im-genes-de-rboles-en-supabase-storage-con-toggle-resize-y-sync
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-12
updated: 2026-04-13
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (via expo/jest-expo) |
| **Config file** | `jest.config.js` or `package.json jest config` |
| **Quick run command** | `npx jest --testPathPattern="photo\|storage\|image\|resize" --passWithNoTests` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern="photo\|storage\|image\|resize" --passWithNoTests`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | D-05 resize | unit | `cd mobile && npx jest tests/services/PhotoService.test.ts` | ✅ | ✅ green |
| 12-01-02 | 01 | 1 | D-03 toggle | unit | `cd mobile && npx jest tests/services/PhotoService.test.ts` | ✅ | ✅ green |
| 12-02-01 | 02 | 2 | D-01 upload | unit | `cd mobile && npx jest tests/services/PhotoService.test.ts` | ✅ | ✅ green |
| 12-02-02 | 02 | 2 | D-02 sync | unit | `cd mobile && npx jest tests/services/PhotoService.test.ts` | ✅ | ✅ green |
| 12-03-01 | 03 | 3 | D-04 camera/gallery picker | manual | Requires device hardware | N/A | ⬜ manual |
| 12-03-02 | 03 | 3 | D-06 image display after sync | manual | Visual verification | N/A | ⬜ manual |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `mobile/tests/services/PhotoService.test.ts` — resize, upload, download, sync, and toggle tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Camera/gallery picker UX | D-04 | Requires device hardware | Open tree detail → tap photo icon → verify picker opens with correct options |
| Image displays correctly after sync | D-06 display | Visual verification | Upload photo, pull from storage, verify image renders at correct resolution |
| Offline photo capture + later sync | D-02 offline | Requires network toggle on device | Take photo offline → go online → trigger sync → verify uploaded |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 complete
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** green — 302 tests passing (2026-04-13)
