# Bayka - Plantation Monitoring App

## What This Is

A mobile application for monitoring ecological restoration plantations, designed for field use in areas with limited or no internet connectivity. Technicians register planted trees organized in SubGroups (planting lines or parcels), working entirely offline. Data syncs manually to a central Supabase backend when connectivity is available. Phase 1 (MVP) targets the Bayka autumn 2026 planting season.

## Core Value

Reliable, fast tree registration in the field — every tree recorded, no data lost, even without connectivity.

## Current Milestone: v1.1 Parcelas + Renombre Subgrupo→Grupo

**Goal:** Introducir Parcelas como nivel intermedio en la jerarquía Plantación → Parcela → Grupo → Árbol, renombrar Subgrupo→Grupo (tipos `linea | bosquete`), y migrar la data de campo existente a la nueva estructura sin degradar la velocidad de registro en campo.

**Target features:**
- Entidad **Parcela** con `nombre` y `codigo` únicos por plantación (más campos pueden agregarse después)
- Renombre completo `subgroup`→`group` en SQLite local, Supabase, código TypeScript y textos visibles
- Tipos de Grupo `linea | bosquete` (reemplaza `linea | parcela`)
- **Nueva ParcelasScreen** (tap en Plantación abre Parcelas; tap en Parcela abre Grupos scoped a esa Parcela)
- **PlantationCard con sección expandible** de parcelas como atajo (mantiene velocidad de registro)
- GruposScreen actualizado: `+` en header (en lugar de botón inferior, por consistencia con Plantaciones y Parcelas)
- **Feature flag `AUTO_PARCELA_DEFAULT`** que auto-crea "Parcela 1" / código "P1" al crear plantación (trial, fácilmente removible)
- **Migración de data Supabase**: 32 → 3 plantaciones (1 producción + 2 prueba consolidadas), 11 plantaciones eliminadas, 6.321 árboles reales preservados bajo "San Sebastián de la Selva"
- Export CSV/Excel: nueva columna "Parcela" entre Plantación y Grupo

**Key context:**
- Field-friendly: el atajo en PlantationCard preserva 3 taps a TreeRegistration; la pantalla intermedia no es obstáculo
- Migración protegida con backup previo (`scripts/supabase-backup.sh` ya existe)
- `tipo='parcela'` no tiene filas en Supabase — la conversión a `bosquete` es solo schema
- `estado='sincronizada'` (269 grupos en server) se normaliza a `finalizada` (Phase 13 ya simplificó esto local)
- UI consistente con paleta existente (theme.ts) y patrones de cards/header

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
- **(v1.1) Campos extra de Parcela** (foto, color, área, descripción) — solo `nombre` + `codigo` en este milestone
- **(v1.1) GPS / coordenadas geográficas de Parcela** — futura iteración, vía **upload de archivo KML/KMZ** (formato Google Earth/Maps) tanto desde la app móvil como desde la web. NO se agregan columnas/campos GPS al schema de `parcelas` en v1.1
- **(v1.1) Captura manual punto-a-punto de GPS** — pendiente de evaluar (ver Issue de GitHub vinculado); posiblemente detrás de un setting toggle si se decide implementar
- **(v1.1) Re-asignación de Grupo a otra Parcela** — Grupo nace dentro de una Parcela y queda ahí (admin puede borrar y recrear si necesario)
- **(v1.1) Sub-parcelas** o jerarquías más profundas — Parcela es el único nivel intermedio
- **(v1.1) Sync atómico de Parcela completa** — Grupo sigue siendo unidad atómica de sync

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
| (v1.1) Parcela como entidad intermedia | Datos de campo se capturaron como "una plantación por parcela"; consolidar en jerarquía correcta | — Pending |
| (v1.1) ParcelasScreen + atajo en PlantationCard | Mantener velocidad de registro sin perder claridad de jerarquía | — Pending |
| (v1.1) Feature flag para auto-Parcela "P1" | Trial: probamos si simplifica creación; debe ser removible si no aporta | — Pending |
| (v1.1) Renombre `subgroup`→`group` end-to-end | Coherencia: el término "Subgrupo" deja de tener sentido cuando Parcela es el "grupo padre" | — Pending |
| (v1.1) Tipos `linea | bosquete` | "parcela" como tipo confunde con la nueva entidad Parcela; "bosquete" es el término correcto del dominio | — Pending |
| (v1.1) GPS de Parcela diferido a futura iteración vía KML/KMZ | No agregar campos schema ahora si no se implementa; KML/KMZ es estándar Google Maps/Earth y permite upload simple desde app y web; captura manual punto-a-punto queda como decisión separada (ver issue) | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-04 — Milestone v1.1 (Parcelas) initialized*
