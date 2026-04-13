---
phase: 13
slug: unificar-sync-bidireccional
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | mobile/jest.config.js |
| **Quick run command** | `cd mobile && npx jest --testPathPattern` |
| **Full suite command** | `cd mobile && npx jest` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd mobile && npx jest --testPathPattern`
- **After every plan wave:** Run `cd mobile && npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | D-11 | unit | `grep pendingSync mobile/src/database/schema.ts` | ⬜ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | D-05 | unit | `grep pendingSync mobile/src/repositories/SubGroupRepository.ts` | ⬜ W0 | ⬜ pending |
| 13-02-01 | 02 | 1 | D-01 | manual | Visual: single "Sincronizar" button | N/A | ⬜ pending |
| 13-02-02 | 02 | 1 | D-04 | unit | `grep useSyncSetting mobile/src/hooks/` | ⬜ W0 | ⬜ pending |
| 13-03-01 | 03 | 2 | D-08 | unit | `grep syncPending mobile/src/theme.ts` | ⬜ W0 | ⬜ pending |
| 13-03-02 | 03 | 2 | D-09 | manual | Visual: orange dot on cards | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.

*This phase is primarily refactoring existing sync code and adding a schema column. Validation is via grep checks and manual visual inspection.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Single "Sincronizar" button replaces two buttons | D-01 | UI layout verification | Open PlantacionesScreen, verify single sync button in header and bottom sheet |
| Orange dot appears on cards with pending sync | D-08, D-09 | Visual indicator | Create local change, verify orange dot on PlantationCard and SubGroupCard |
| Sync pull+push executes bidirectionally | D-01 | Requires Supabase server | Trigger sync, verify pull then push completes |
| Photo setting persists across app restarts | D-04 | Persistence check | Toggle setting, kill app, reopen, verify setting retained |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
