---
phase: 12
slug: persistir-im-genes-de-rboles-en-supabase-storage-con-toggle-resize-y-sync
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
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
| 12-01-01 | 01 | 1 | D-05 resize | unit | `npx jest --testPathPattern="resize"` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | D-03 toggle | unit | `npx jest --testPathPattern="toggle\|settings"` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 2 | D-01 upload | integration | `npx jest --testPathPattern="storage\|upload"` | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 2 | D-02 sync | integration | `npx jest --testPathPattern="sync\|photo"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/services/photoService.test.ts` — stubs for resize, upload, download
- [ ] `src/__tests__/services/photoSyncService.test.ts` — stubs for sync logic
- [ ] `src/__tests__/hooks/usePhotoSettings.test.ts` — stubs for toggle behavior

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Camera/gallery picker UX | D-04 | Requires device hardware | Open tree detail → tap photo icon → verify picker opens with correct options |
| Image displays correctly after sync | D-06 display | Visual verification | Upload photo, pull from storage, verify image renders at correct resolution |
| Offline photo capture + later sync | D-02 offline | Requires network toggle on device | Take photo offline → go online → trigger sync → verify uploaded |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
