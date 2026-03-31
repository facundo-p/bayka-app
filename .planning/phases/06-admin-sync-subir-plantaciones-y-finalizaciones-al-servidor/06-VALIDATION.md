---
phase: 6
slug: admin-sync-subir-plantaciones-y-finalizaciones-al-servidor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
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
| 06-01-01 | 01 | 1 | Catalog query | unit | `npx jest --testPathPattern=catalogQueries` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | Download service | unit | `npx jest --testPathPattern=DownloadService` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | Catalog screen | unit | `npx jest --testPathPattern=CatalogScreen` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | Header icon nav | unit | `npx jest --testPathPattern=PlantacionesScreen` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `mobile/src/queries/__tests__/catalogQueries.test.ts` — stubs for server catalog queries
- [ ] `mobile/src/services/__tests__/DownloadService.test.ts` — stubs for download orchestration

*Existing test infrastructure (jest config, mocking patterns) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Modal progress bar during download | D-08 | Visual UI behavior | Open catalog, select plantations, tap download, verify modal shows with progress |
| Connectivity icon tap opens catalog | D-02 | Navigation + visual | Verify online icon is tappable, navigates to catalog; verify offline icon is disabled |
| Already-downloaded indicator | D-05 | Visual distinction | Download a plantation, reopen catalog, verify it shows as downloaded and is not selectable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
