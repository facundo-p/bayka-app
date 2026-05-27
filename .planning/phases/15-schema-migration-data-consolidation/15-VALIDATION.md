---
phase: 15
slug: schema-migration-data-consolidation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-05
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (existing) + SQL verification scripts |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npm test -- --testPathPattern='idGenerator\|migrations' --bail` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30s quick / ~2min full |

---

## Sampling Rate

- **After every task commit:** Run `{quick run command}`
- **After every plan wave:** Run `{full suite command}`
- **Before `/gsd-verify-work`:** Full suite must be green + SQL verification queries pass
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-XX | 01 | 1 | PARC-01..04, MIGR-01 | — | N/A | unit | `npm test -- idGenerator` | ❌ W0 | ⬜ pending |
| 15-02-XX | 02 | 1 | PARC-05..08, MIGR-02..04 | — | RLS denies non-admin write to `parcelas` | integration | SQL verification script `scripts/verify-012.sh` | ❌ W0 | ⬜ pending |
| 15-03-XX | 03 | 0 | MIGR-05..11 | — | Backup exists pre-migration | manual+sql | `scripts/audit-v1.1-consolidation.sql` | ✅ | ⬜ pending |
| 15-03-XX | 03 | 1 | MIGR-06..09 | — | Counts: 3 plant / 21 parc / 225 grp / 6.776 trees | sql | `scripts/verify-013.sh` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · Detailed map populated by planner per-task.*

---

## Wave 0 Requirements

- [ ] `scripts/supabase-backup.sh` — backup script per Success Criterion #1
- [ ] `scripts/verify-012.sh` — post-DDL verification (tables, columns, indexes, RLS, RPC body)
- [ ] `scripts/verify-013.sh` — post-data verification (counts, SubID uniqueness, no NULLs, no orphans)
- [ ] `supabase/migrations/data/015_consolidation_mapping.md` — populated mapping (currently skeleton with `<uuid>` placeholders) — **BLOCKER for Plan 15-03**
- [ ] Run `scripts/audit-v1.1-consolidation.sql` against production and capture results in mapping doc

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Backup restore documented and tested | MIGR-01 | Requires Supabase CLI access + dry-run restore | Run backup script, document restore command in `docs/`, test restore on staging project |
| Tester device pulls new schema on next sync without manual action | Success Criterion #10 | Requires real device with pre-migration SQLite | Install pre-merge build → trigger sync → verify schema upgraded + 6.776 trees visible |
| RLS prevents tecnico from creating/deleting parcelas | PARC-08 | Requires real auth tokens for admin and tecnico roles | Use Supabase dashboard SQL editor with `set role` to simulate each role |
| Two parcelas with colliding group code "L1" coexist | Success Criterion #5 | Spot-check requires reading data | SQL: `SELECT parcela_id, codigo, COUNT(*) FROM groups GROUP BY parcela_id, codigo HAVING COUNT(*) > 1` should return 0 rows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (audit + mapping doc + verify scripts)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
