# Bayka - Plantation Monitoring App

## What This Is

A mobile application for monitoring ecological restoration plantations, designed for field use in areas with limited or no internet connectivity. Technicians register planted trees organized in SubGroups (planting lines or parcels), working entirely offline. Data syncs manually to a central Supabase backend when connectivity is available. Phase 1 (MVP) targets the Bayka autumn 2026 planting season.

## Core Value

Reliable, fast tree registration in the field — every tree recorded, no data lost, even without connectivity.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Offline-first architecture with local SQLite storage
- [ ] User authentication via Supabase Auth (email/password)
- [ ] Role-based access (admin / tecnico)
- [x] Admin: create plantations with lugar + periodo (validated Phase 4 online, Phase 10 offline)
- [ ] Admin: configure species available per plantation (from global catalog)
- [ ] Admin: assign technicians to plantations
- [ ] Admin: finalize plantations and generate final IDs
- [ ] Admin: export plantation data to CSV/Excel
- [ ] Technician: view assigned plantations on dashboard with stats
- [ ] Technician: create SubGroups (linea/parcela) with unique code per plantation
- [ ] Technician: register trees via species button grid (one-tap registration)
- [ ] Technician: attach optional photos (camera/gallery) to trees
- [ ] Technician: register unidentified trees as N/N (photo mandatory)
- [ ] Technician: resolve N/N trees before sync
- [ ] Technician: reverse tree order within a SubGroup
- [ ] Technician: finalize and sync SubGroups manually
- [ ] SubGroup sync unit: sends SubGroup + all trees atomically
- [ ] Synced SubGroups become immutable
- [ ] SubID generation: SubGroupCode + SpeciesCode + Position
- [ ] Plantation ID and Global Organization ID generated on finalization
- [ ] Sync conflict detection (duplicate SubGroup code rejection)
- [ ] Download updated data during sync (other technicians' SubGroups, species)
- [ ] Single organization (Bayka) — multi-org architecture prepared but transparent
- [x] Species seeded via initial data load, synced from server during regular sync (validated Phase 10)
- [ ] Users seeded initially (2 admin + 2 tecnico)
- [ ] Saved accounts on login screen: "Recordar cuenta" checkbox saves credentials encrypted in SecureStore; saved accounts appear as tappable chips for quick login on shared devices

### Out of Scope

- Automatic sync — manual only, user-initiated
- Advanced conflict resolution — rejected syncs resolved manually
- Edit synced records — immutability after sync is a design principle
- Species management from app — seed-only in Phase 1
- Multi-organization UI — single org, but schema supports future multi-org
- GIS exports — future phase
- GPS per tree — future phase
- Photo upload to server — photos remain local in Phase 1
- Real-time monitoring / analytics dashboards — future phase

## Context

- **Target event:** Bayka autumn 2026 planting season (real field validation)
- **Field conditions:** Walking users, strong sunlight, dirty/gloved hands, minimal screen time
- **Typical plantation:** ~20 species, multiple SubGroups (lines/parcels), thousands of trees
- **Key UI constraint:** Species button grid must support one-tap registration; buttons must be large enough for gloved use
- **Data model:** Organization → Plantations → SubGroups → Trees, with Species as global catalog
- **SubGroup states:** activa → finalizada → sincronizada
- **Plantation states:** activa → finalizada
- **Existing documentation:** SPECS.md, domain-model.md, architecture.md, ui-ux-guidelines.md in docs/

## Constraints

- **Tech stack:** React Native + TypeScript + Expo (mobile), SQLite (local DB), Supabase (backend + auth)
- **Timeline:** Must be ready for autumn 2026 planting season
- **Connectivity:** App must work 100% offline; sync only when user chooses and has connectivity
- **Performance:** Tree registration must be instant (no loading, no confirmation dialogs)
- **UI simplicity:** Minimal interactions, big buttons, field-optimized interface
- **Data integrity:** Synced data is immutable; SubGroup is atomic sync unit

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Offline-first with SQLite | Field locations lack reliable connectivity | — Pending |
| Supabase as backend | Auth + database + simple API in one service | — Pending |
| SubGroup as sync unit | Prevents partial data inconsistencies | — Pending |
| Photos local-only in Phase 1 | Thousands of trees = too much data for field sync | — Pending |
| Immutable synced data | Guarantees dataset consistency for research use | — Pending |
| Species button grid (one-tap) | Field speed is critical — no confirmation dialogs | — Pending |
| Manual sync only | User controls when data transfers; avoids surprises in low-connectivity | — Pending |
| Users seeded, not self-registered | MVP simplification; only 4 users needed initially | — Pending |

---
*Last updated: 2026-04-08 after Phase 10 completion (offline plantation creation + species catalog sync)*
