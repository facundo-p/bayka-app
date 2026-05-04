# Requirements: Bayka Plantation Monitoring

**Defined:** 2026-03-16
**Core Value:** Reliable, fast tree registration in the field — every tree recorded, no data lost, even without connectivity.

## v1 Requirements

Requirements for initial release (autumn 2026 planting season). Each maps to roadmap phases.

### Foundation

- [x] **FOUN-01**: App bootstraps with Expo SDK 55, React Native, TypeScript
- [x] **FOUN-02**: Local SQLite database initialized with Drizzle ORM schema and migrations
- [x] **FOUN-03**: Species catalog seeded into local database on first launch
- [x] **FOUN-04**: Users seeded in Supabase (2 admin + 2 tecnico)
- [x] **FOUN-05**: Supabase backend schema deployed (organizations, users, plantations, subgroups, trees, species)

### Authentication

- [x] **AUTH-01**: User can log in with email and password via Supabase Auth
- [x] **AUTH-02**: User session persists across app restarts (offline-safe token storage)
- [x] **AUTH-03**: User can log out from any screen
- [x] **AUTH-04**: App detects user role (admin/tecnico) and shows appropriate navigation
- [x] **AUTH-05**: Different users can log in on the same device

### Dashboard

- [x] **DASH-01**: Technician sees list of assigned plantations after login
- [x] **DASH-02**: Admin sees all plantations for the organization
- [x] **DASH-03**: Each plantation shows total trees registered and synced
- [x] **DASH-04**: Each plantation shows user's unsynced tree count
- [x] **DASH-05**: Each plantation shows user's total tree count
- [x] **DASH-06**: Each plantation shows user's trees registered today

### Plantation Management

- [x] **PLAN-01**: Admin can create a plantation with lugar and periodo
- [x] **PLAN-02**: Admin can select species from global catalog for a plantation
- [x] **PLAN-03**: Admin can assign technicians to a plantation
- [x] **PLAN-04**: Admin can add more species to a plantation after creation
- [x] **PLAN-05**: Admin can define visual order of species buttons
- [x] **PLAN-06**: Admin can finalize a plantation (when all SubGroups synced)

### SubGroup Management

- [x] **SUBG-01**: Technician can create a SubGroup with name, code, and type (linea/parcela)
- [x] **SUBG-02**: SubGroup code must be unique within the plantation
- [x] **SUBG-03**: System shows last created SubGroup name when creating a new one
- [x] **SUBG-04**: Technician can view list of SubGroups with state indicators (activa/finalizada/sincronizada)
- [x] **SUBG-05**: Technician can finalize a SubGroup (activa -> finalizada)
- [x] **SUBG-06**: Synced SubGroups are immutable (no edit allowed)
- [x] **SUBG-07**: Technician can only edit SubGroups they created

### Tree Registration

- [x] **TREE-01**: Technician sees species button grid when registering trees in a SubGroup
- [x] **TREE-02**: One tap on a species button creates a tree record instantly (no confirmation)
- [x] **TREE-03**: Tree position increments automatically within the SubGroup
- [x] **TREE-04**: SubID generated automatically (SubGroupCode + SpeciesCode + Position)
- [x] **TREE-05**: Last 3 registered trees displayed on registration screen
- [x] **TREE-06**: Technician can attach optional photo to any tree (camera or gallery)
- [x] **TREE-07**: Technician can delete the last registered tree (undo)

### N/N Workflow

- [x] **NN-01**: Technician can register unidentified tree as N/N via dedicated button
- [x] **NN-02**: Photo is mandatory when registering N/N tree
- [x] **NN-03**: N/N resolution screen shows photo and species selector
- [x] **NN-04**: Technician can resolve N/N by selecting correct species
- [x] **NN-05**: SubGroup with unresolved N/N trees cannot be synced

### Reverse Order

- [x] **REVR-01**: Technician can reverse tree order within a SubGroup
- [x] **REVR-02**: Reverse recalculates all tree positions
- [x] **REVR-03**: Reverse only allowed before SubGroup is synced

### Sync

- [x] **SYNC-01**: Technician can manually initiate sync for finalizada SubGroups
- [x] **SYNC-02**: Sync uploads SubGroup + all trees as atomic unit
- [x] **SYNC-03**: Server rejects sync if SubGroup code already exists in plantation
- [x] **SYNC-04**: Sync conflict shows clear error message to user
- [x] **SYNC-05**: Successful sync marks SubGroup as sincronizada (immutable)
- [x] **SYNC-06**: During sync, app downloads updated data from other technicians
- [x] **SYNC-07**: User can see list of SubGroups pending sync

### ID Generation

- [x] **IDGN-01**: Admin triggers ID generation after plantation finalization
- [x] **IDGN-02**: Plantation ID assigned sequentially within the plantation
- [x] **IDGN-03**: Global Organization ID assigned sequentially across all plantations
- [x] **IDGN-04**: Admin can set initial seed for Global Organization ID (system suggests n+1)

### Export

- [x] **EXPO-01**: Admin can export finalized plantation to CSV
- [x] **EXPO-02**: Admin can export finalized plantation to Excel
- [x] **EXPO-03**: Export includes: ID Global, ID Parcial, Zona, SubGrupo, SubID, Periodo, Especie

### Plantation Catalog + Download

- [x] **CATL-01**: User can browse a catalog of server plantations (dedicated screen, role-gated)
- [x] **CATL-02**: Catalog access via tappable connectivity icon in PlantacionesScreen header (online only)
- [x] **CATL-03**: User can batch-select and download plantations with checkboxes and download button
- [x] **CATL-04**: Download includes full data (plantation + species + users + subgroups + trees) for offline access
- [x] **CATL-05**: Blocking progress modal shows per-plantation download progress with plantation name
- [x] **CATL-06**: Catalog visibility is role-gated (admin: all org plantations, tecnico: assigned only)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Location

- **LOC-01**: GPS coordinates captured per SubGroup (line start/end or polygon)
- **LOC-02**: GIS export (GeoJSON, Shapefile)

### Photos

- **PHOT-01**: Batch photo upload to server via Wi-Fi
- **PHOT-02**: Photo storage in Supabase Storage

### Multi-Organization

- **MORG-01**: Multi-organization UI and management
- **MORG-02**: User self-registration with admin approval

### Monitoring

- **MONR-01**: Follow-up monitoring workflow (tree survival surveys)
- **MONR-02**: Analytics dashboards (web-based)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Automatic background sync | Fails silently in low-connectivity; breaks SubGroup atomicity |
| Edit synced records | Immutability is a design principle for data integrity |
| Real-time multi-user dashboard | Requires persistent connections incompatible with offline-first |
| GPS per tree | GPS accuracy (+-3-5m) meaningless at tree spacing (1-2m) |
| Species management from app | Species codes embedded in SubIDs; changes corrupt existing records |
| Confirmation dialogs on tree tap | Doubles registration time; unacceptable for field speed |
| Complex conflict resolution UI | Low conflict rate doesn't justify complexity; manual rename sufficient |
| AI species identification | Requires training data and connectivity; future consideration |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUN-01 | Phase 1 | Complete |
| FOUN-02 | Phase 1 | Complete |
| FOUN-03 | Phase 1 | Complete |
| FOUN-04 | Phase 1 | Complete |
| FOUN-05 | Phase 1 | Complete |
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| SUBG-01 | Phase 2 | Complete |
| SUBG-02 | Phase 2 | Complete |
| SUBG-03 | Phase 2 | Complete |
| SUBG-04 | Phase 2 | Complete |
| SUBG-05 | Phase 2 | Complete |
| SUBG-06 | Phase 2 | Complete |
| SUBG-07 | Phase 2 | Complete |
| TREE-01 | Phase 2 | Complete |
| TREE-02 | Phase 2 | Complete |
| TREE-03 | Phase 2 | Complete |
| TREE-04 | Phase 2 | Complete |
| TREE-05 | Phase 2 | Complete |
| TREE-06 | Phase 2 | Complete |
| TREE-07 | Phase 2 | Complete |
| NN-01 | Phase 2 | Complete |
| NN-02 | Phase 2 | Complete |
| NN-03 | Phase 2 | Complete |
| NN-04 | Phase 2 | Complete |
| NN-05 | Phase 2 | Complete |
| REVR-01 | Phase 2 | Complete |
| REVR-02 | Phase 2 | Complete |
| REVR-03 | Phase 2 | Complete |
| SYNC-01 | Phase 3 | Complete |
| SYNC-02 | Phase 3 | Complete |
| SYNC-03 | Phase 3 | Complete |
| SYNC-04 | Phase 3 | Complete |
| SYNC-05 | Phase 3 | Complete |
| SYNC-06 | Phase 3 | Complete |
| SYNC-07 | Phase 3 | Complete |
| DASH-01 | Phase 3 | Complete |
| DASH-02 | Phase 3 | Complete |
| DASH-03 | Phase 3 | Complete |
| DASH-04 | Phase 3 | Complete |
| DASH-05 | Phase 3 | Complete |
| DASH-06 | Phase 3 | Complete |
| PLAN-01 | Phase 4 | Complete |
| PLAN-02 | Phase 4 | Complete |
| PLAN-03 | Phase 4 | Complete |
| PLAN-04 | Phase 4 | Complete |
| PLAN-05 | Phase 4 | Complete |
| PLAN-06 | Phase 4 | Complete |
| IDGN-01 | Phase 4 | Complete |
| IDGN-02 | Phase 4 | Complete |
| IDGN-03 | Phase 4 | Complete |
| IDGN-04 | Phase 4 | Complete |
| EXPO-01 | Phase 4 | Complete |
| EXPO-02 | Phase 4 | Complete |
| EXPO-03 | Phase 4 | Complete |
| CATL-01 | Phase 6 | Complete |
| CATL-02 | Phase 6 | Complete |
| CATL-03 | Phase 6 | Complete |
| CATL-04 | Phase 6 | Complete |
| CATL-05 | Phase 6 | Complete |
| CATL-06 | Phase 6 | Complete |

**Coverage:**
- v1 requirements: 63 total
- Mapped to phases: 63
- Unmapped: 0

---

## Milestone v1.1 Requirements — Parcelas + Renombre Subgrupo→Grupo

**Defined:** 2026-05-04
**Goal:** Introducir Parcelas como nivel intermedio (Plantación → Parcela → Grupo → Árbol), renombrar Subgrupo→Grupo (tipos `linea | bosquete`), y migrar la data de campo existente a la nueva estructura.

### Schema & Data Model (Parcelas + Renombre)

- [ ] **PARC-01**: Tabla `parcelas` creada en SQLite local con columnas `id`, `plantacion_id` (FK), `nombre`, `codigo`, `pending_sync`, `created_at`, `updated_at`
- [ ] **PARC-02**: Tabla `parcelas` creada en Supabase con FK a `plantations`, RLS para admin/tecnico
- [ ] **PARC-03**: Constraint de unicidad: `(plantacion_id, nombre)` único y `(plantacion_id, codigo)` único — local y server
- [ ] **PARC-04**: Tabla `subgroups` renombrada a `groups` en SQLite local (con migración Drizzle versionada)
- [ ] **PARC-05**: Tabla `subgroups` renombrada a `groups` en Supabase, columna `subgroup_id` de `trees` renombrada a `group_id`
- [ ] **PARC-06**: Columna `groups.parcela_id` (FK) agregada — todo grupo pertenece a una parcela
- [ ] **PARC-07**: Tipo de Grupo cambiado: valor `'parcela'` deprecado, `'bosquete'` agregado (constraint `tipo IN ('linea','bosquete')`)
- [ ] **PARC-08**: SubID de árbol mantiene formato `GroupCode + SpeciesCode + Position` — la Parcela no se incluye en el SubID

### Code Layer Rename (TypeScript / Repos / Hooks / Queries)

- [ ] **GRPN-01**: Tipos TS renombrados: `SubGroup`→`Group`, `SubGroupEstado`→`GroupEstado`, `SubGroupTipo`→`GroupTipo`
- [ ] **GRPN-02**: `SubGroupRepository.ts` renombrado a `GroupRepository.ts` con todos sus métodos actualizados
- [ ] **GRPN-03**: Hooks renombrados: `useSubGroups`→`useGroups`, `useSubGroupActions`→`useGroupActions`, etc.
- [ ] **GRPN-04**: Queries: `subgroupQueries.ts`→`groupQueries.ts`; campos como `subgrupoId`, `subgrupoCodigo` → `grupoId`, `grupoCodigo`
- [ ] **GRPN-05**: Servicios: `SyncService` actualizado con métodos para parcelas (pull/push) y rename de identificadores
- [ ] **GRPN-06**: Componentes UI renombrados: `SubGroupCard`→`GroupCard`, `SubGroupStateChip`→`GroupStateChip`, `SubgrupoForm`→`GrupoForm`
- [ ] **GRPN-07**: Pantalla `NuevoSubgrupoScreen.tsx` renombrada a `NuevoGrupoScreen.tsx`
- [ ] **GRPN-08**: Todas las referencias en español de "Subgrupo"/"subgrupo"/"subgroups" en strings visibles cambiadas a "Grupo"/"grupo"/"grupos"
- [ ] **GRPN-09**: Tests existentes actualizados para reflejar nombres nuevos (sin perder cobertura)

### Parcelas — Data Layer

- [ ] **PCRD-01**: `ParcelaRepository.ts` con métodos `create`, `update`, `delete`, `getByPlantacion`, `getById`
- [ ] **PCRD-02**: `parcelaQueries.ts` con queries para stats (cantidad de grupos y árboles por parcela)
- [ ] **PCRD-03**: Hook `useParcelas(plantacionId)` con datos reactivos vía `useLiveData`
- [ ] **PCRD-04**: Validación de unicidad de `nombre` y `codigo` por plantación al crear/editar (UI + repo)
- [ ] **PCRD-05**: Borrar Parcela bloqueado si tiene grupos dentro; mensaje claro al usuario
- [ ] **PCRD-06**: Soporte offline: parcelas creadas offline se marcan `pending_sync=true` y se suben en próximo sync

### Parcelas — UI / Navegación

- [ ] **PUI-01**: Pantalla nueva `ParcelasScreen` lista parcelas con `nombre`, `codigo`, conteo de grupos, conteo de árboles, OrangeDot si algún grupo dentro tiene `pending_sync`
- [ ] **PUI-02**: Tap en `PlantationCard` navega a `ParcelasScreen` (antes navegaba directo a la pantalla de grupos)
- [ ] **PUI-03**: Tap en una `ParcelaRow` navega a `GruposScreen` scoped a esa parcela (lista solo grupos de esa parcela)
- [ ] **PUI-04**: Long-press en `ParcelaRow` abre modal de edición de Parcela
- [ ] **PUI-05**: Header de `ParcelasScreen` tiene icono `+` a la derecha que abre form de crear Parcela
- [ ] **PUI-06**: Empty state en `ParcelasScreen` cuando no hay parcelas (mensaje + CTA grande "Crear primera parcela")
- [ ] **PUI-07**: `PlantationCard` muestra fila inferior "Parcelas: N" con chevron como botón
- [ ] **PUI-08**: Tap en la fila inferior expande sección inline con la lista de parcelas (reusa el mismo `ParcelaRow` que `ParcelasScreen`)
- [ ] **PUI-09**: Tap en parcela dentro de la sección expandida navega a `GruposScreen` scoped (mismo flujo que la pantalla de Parcelas)
- [ ] **PUI-10**: Long-press en parcela dentro de la sección expandida abre el mismo modal de edición

### Group Screen — Refactor menor (consistencia con Parcelas/Plantaciones)

- [ ] **GUI-01**: `GruposScreen` (ex pantalla de Subgrupos) elimina el botón inferior "Agregar grupo"
- [ ] **GUI-02**: `GruposScreen` agrega icono `+` a la derecha del header (consistencia con Plantaciones y Parcelas)
- [ ] **GUI-03**: `GruposScreen` recibe `parcelaId` y filtra grupos solo de esa parcela
- [ ] **GUI-04**: Al crear un Grupo, se asocia automáticamente a la `parcelaId` de contexto (sin selector adicional)

### Default Parcela (Feature Flag — Trial)

- [ ] **PDEF-01**: Feature flag `AUTO_PARCELA_DEFAULT` en `mobile/src/config/featureFlags.ts` (o equivalente)
- [ ] **PDEF-02**: Cuando el flag está activo, al crear una Plantación se auto-crea inmediatamente una Parcela con `nombre="Parcela 1"`, `codigo="P1"` vinculada a esa plantación
- [ ] **PDEF-03**: La auto-creación está aislada en una función única (`createPlantationWithDefaultParcela()` o similar), comentada con `// FEATURE: auto-parcela trial — remove block if dropped`
- [ ] **PDEF-04**: La feature funciona tanto online como offline (al sincronizar, la parcela default sube junto con la plantación)

### Sync — Parcelas

- [ ] **SYNC-PARC-01**: `SyncService.pullFromServer` incluye parcelas: trae todas las parcelas del servidor para las plantaciones del usuario
- [ ] **SYNC-PARC-02**: `SyncService.pushToServer` sube parcelas locales con `pending_sync=true`
- [ ] **SYNC-PARC-03**: Conflict detection: nombre/código duplicado al subir → error claro al usuario, parcela queda local con `pending_sync=true`
- [ ] **SYNC-PARC-04**: La unidad atómica de sync sigue siendo el **Grupo** — la Parcela es metadata sincronizable independiente
- [ ] **SYNC-PARC-05**: `pending_sync` propagación visual: PlantationCard muestra OrangeDot si CUALQUIER cosa adentro (parcela, grupo, árbol) está pendiente

### Migración de Data en Supabase

- [ ] **MIGR-01**: Backup completo de Supabase antes de la migración (script `scripts/supabase-backup.sh` ejecutado y verificado)
- [ ] **MIGR-02**: Script SQL versionado en `supabase/migrations/012_parcelas_and_rename.sql` aplica el rename `subgroups`→`groups` y crea tabla `parcelas`
- [ ] **MIGR-03**: Script SQL versionado en `supabase/migrations/013_data_consolidation.sql` consolida los clusters según el plan acordado
- [ ] **MIGR-04**: **Cluster A** unificado bajo plantación nueva `"San Sebastián de la Selva"` (Otoño 2026) con 17 parcelas siguiendo el mapping: SSS-Loma-P1..P13 → Loma-P1..P13 (códigos LP1..LP13), SSS-Medio-P1..P4 → Medio-P1..P4 (códigos MP1..MP4); todos los grupos y árboles preservados (215 grupos, 6.321 árboles)
- [ ] **MIGR-05**: **Cluster B** unificado bajo plantación nueva `"Pruebas - SSS"` (Otoño 2026) con 2 parcelas: "Selva Original" (código SO) y "P3 Vieja" (código P3V); 5 grupos, 114 árboles preservados
- [ ] **MIGR-06**: **Cluster C** unificado bajo plantación nueva `"Pruebas - La Morita"` (Primavera 2026) con 2 parcelas: "La Morita" (código LM) y "Zona 1" (código Z1); 5 grupos, 341 árboles preservados
- [ ] **MIGR-07**: 11 plantaciones eliminadas (cascade delete: plantación + grupos + árboles): `00000000` La Maluka, `e072775e` SSS-LOMA-P1 vacío, `80b85acd` Plantación Abril, `26e190db` Hfhj, `747981d3` Plantacion test 1, `0eea0006` Aa, `a536bd66` Plant 2, `09a315e2` Plant 3, `203beee5` Plant 4, `6d2e80b0` Plantación test 2, `7fea8850` Plant Test 4 — totalizando 44 grupos y 433 árboles eliminados
- [ ] **MIGR-08**: Normalización de estados: 269 grupos con `estado='sincronizada'` en server → `estado='finalizada'` (alineado con Phase 13)
- [ ] **MIGR-09**: Verificación post-migración: conteos esperados (3 plantaciones, 21 parcelas, 225 grupos, 6.776 árboles), referencias FK consistentes, nombres y códigos únicos por plantación, queries cargan correctamente
- [ ] **MIGR-10**: SQLite local de cada usuario se sincroniza automáticamente con la nueva estructura en el siguiente pull (sin acción manual)

### Export

- [ ] **EXPO-PARC-01**: Export CSV/Excel agrega columna "Parcela" entre "Plantación" y "Grupo" (queda: ID Global, ID Parcial, Zona, Plantación, **Parcela**, Grupo, SubID, Periodo, Especie)
- [ ] **EXPO-PARC-02**: La columna "Parcela" muestra `nombre` de la Parcela (no código)

### Testing

- [ ] **TEST-PARC-01**: Tests unitarios de `ParcelaRepository`: create, update, delete, validaciones de unicidad
- [ ] **TEST-PARC-02**: Tests unitarios de `useParcelas` hook con mock de DB
- [ ] **TEST-PARC-03**: Tests de integración del sync de parcelas (pull + push, conflict)
- [ ] **TEST-PARC-04**: Tests de la migración SQL (idempotencia, conteos esperados, rollback funcional)
- [ ] **TEST-PARC-05**: Tests del feature flag `AUTO_PARCELA_DEFAULT` (on/off)

### Future Requirements (Deferred)

- Campos extra de Parcela: GPS, foto, color, área, descripción
- Re-asignación de Grupo a otra Parcela
- Sub-parcelas (jerarquía deeper)
- Sync atómico de Parcela completa
- Bulk operations (mover N grupos a otra parcela, eliminar N parcelas, etc.)
- Estadísticas avanzadas por Parcela en dashboard

### Out of Scope v1.1

- Cambios al modelo de árboles (siguen igual)
- Cambios a la pantalla de registro de árboles (solo recibe `grupoId` como antes, ahora `groupId`)
- N/N resolution flow (sin cambios — ya en v1.0)
- Nuevos roles o permisos (admin y tecnico siguen igual; ambos crean Parcelas y Grupos)
- ID Global / ID Parcial generation (sin cambios)

### Traceability v1.1

| REQ-ID | Phase | Status |
|--------|-------|--------|
| PARC-01 to PARC-08 | Phase 15 | Planned |
| GRPN-01 to GRPN-09 | Phase 15-16 | Planned |
| PCRD-01 to PCRD-06 | Phase 16 | Planned |
| PUI-01 to PUI-10 | Phase 17 | Planned |
| GUI-01 to GUI-04 | Phase 17 | Planned |
| PDEF-01 to PDEF-04 | Phase 18 | Planned |
| SYNC-PARC-01 to SYNC-PARC-05 | Phase 16 | Planned |
| MIGR-01 to MIGR-10 | Phase 15 | Planned |
| EXPO-PARC-01 to EXPO-PARC-02 | Phase 18 | Planned |
| TEST-PARC-01 to TEST-PARC-05 | Phase 16-17 | Planned |

**Coverage v1.1:**
- Total requirements: 49
- Mapped to phases: 49
- Unmapped: 0

---
*Requirements defined: 2026-03-16 (v1.0), 2026-05-04 (v1.1)*
*Last updated: 2026-05-04 — Milestone v1.1 requirements defined*
