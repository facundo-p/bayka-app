# Phase 9: Testing Strategy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 09-testing-strategy
**Areas discussed:** Test coverage priorities, Test types & tooling, Offline simulation strategy, Test data & fixtures, CI/CD

---

## Test Coverage Priorities

| Option | Description | Selected |
|--------|-------------|----------|
| Critical paths first | Focus on offline flow, sync pipeline, data integrity. Cover paths where bug = data loss | ✓ |
| Layer-by-layer coverage | Complete all repository tests first, then queries, then hooks. Systematic. | |
| Risk-based by phase | Test each phase's functionality in order of business risk | |

**User's choice:** Critical paths first
**Notes:** Prioritize: offline > sync > data integrity > role-based access

| Option | Description | Selected |
|--------|-------------|----------|
| Data + service layer only | Repositories, queries, services, and key hooks. Highest ROI. | ✓ |
| Include key hooks too | Add useAuth, useSync, useSubGroups, useTrees | |
| Full stack including screens | Add screen-level render tests with RNTL | |

**User's choice:** Data + service layer only
**Notes:** No screen tests in this phase

---

## Test Types & Tooling

| Option | Description | Selected |
|--------|-------------|----------|
| Real SQLite integration tests | In-memory SQLite for critical paths | ✓ |
| Keep mocked only | Stick with current mock pattern | |
| Both unit mocked + integration real | Two suites | |

**User's choice:** Real SQLite integration tests

| Option | Description | Selected |
|--------|-------------|----------|
| Maestro E2E basics | 2-3 flows in YAML: login offline, register tree, sync | ✓ |
| Skip E2E for now | Integration tests cover critical paths | |
| Detox E2E basics | React Native standard, heavier setup | |

**User's choice:** Maestro E2E basics
**Notes:** User asked for detailed Maestro vs Detox comparison before deciding. Chose Maestro for simpler setup and YAML readability.

### Refactor Discussion (emerged from tooling area)

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 9 = refactor + testing | First refactor (dedup, split large files), then test | ✓ |
| Phase separada de refactor | Phase 9 = refactor, Phase 10 = testing | |
| Nota para después | Test first, refactor later | |

**User's choice:** Phase 9 = refactor + testing
**Notes:** User identified files >500 lines and duplicate code between admin/tecnico as refactor targets

---

## Offline Simulation Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Mock NetInfo directo | Each test configures its own mock | |
| Test helpers con toggle | Centralized setOffline()/setOnline() functions | ✓ |
| Solo Maestro airplane mode | E2E-only offline simulation | |

**User's choice:** Test helpers con toggle
**Notes:** User asked for detailed comparison between options 1 and 2. Chose centralized helpers for DRY principle and consistency with CLAUDE.md "un solo lugar" rule.

---

## Test Data & Fixtures

| Option | Description | Selected |
|--------|-------------|----------|
| Factory functions | createTestPlantation(), createTestSubGroup() with defaults + overrides | ✓ |
| Fixtures JSON estáticas | JSON files in tests/fixtures/ | |
| Inline por test (actual) | Keep current pattern | |

**User's choice:** Factory functions

| Option | Description | Selected |
|--------|-------------|----------|
| Mínimos pero representativos | 2-3 plantations, 5-10 subgroups, 20-30 trees | ✓ |
| Volumen realista de campo | 20 species, 50+ subgroups, 1000+ trees | |
| You decide | Claude decides per test | |

**User's choice:** Mínimos pero representativos

---

## CI/CD

| Option | Description | Selected |
|--------|-------------|----------|
| Push + PR a main | Tests on every push and every PR to main | ✓ |
| Solo en PRs a main | Only on PRs | |
| Push a todas las branches | Every push everywhere | |

**User's choice:** Push + PR a main

| Option | Description | Selected |
|--------|-------------|----------|
| Lint + Unit + Integration | 3 parallel jobs, no E2E | For branches ✓ |
| Solo tests | Single npm test job | |
| Full pipeline con E2E | Lint + Unit + Integration + Maestro E2E | For main ✓ |

**User's choice:** Two-tier — Option 1 for branch pushes, Option 3 for main PR/push
**Notes:** Escalonado: fast feedback on branches, full gate on main

| Option | Description | Selected |
|--------|-------------|----------|
| Sí, required checks | Block merge if CI fails | ✓ |
| No, advisory only | CI runs but doesn't block | |

**User's choice:** Sí, required checks

---

## Claude's Discretion

- Integration test SQLite setup/teardown mechanics
- Factory function defaults and internal implementation
- Maestro flow file organization
- GitHub Actions YAML structure and caching
- Specific files needing refactor (determined by analysis)

## Deferred Ideas

- Performance/load testing with field-realistic volumes — future phase
- Screen-level render tests — future phase
- Visual regression testing — future phase
