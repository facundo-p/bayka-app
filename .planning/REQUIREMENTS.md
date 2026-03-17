# Requirements: Bayka Plantation Monitoring

**Defined:** 2026-03-16
**Core Value:** Reliable, fast tree registration in the field — every tree recorded, no data lost, even without connectivity.

## v1 Requirements

Requirements for initial release (autumn 2026 planting season). Each maps to roadmap phases.

### Foundation

- [ ] **FOUN-01**: App bootstraps with Expo SDK 55, React Native, TypeScript
- [ ] **FOUN-02**: Local SQLite database initialized with Drizzle ORM schema and migrations
- [ ] **FOUN-03**: Species catalog seeded into local database on first launch
- [ ] **FOUN-04**: Users seeded in Supabase (2 admin + 2 tecnico)
- [ ] **FOUN-05**: Supabase backend schema deployed (organizations, users, plantations, subgroups, trees, species)

### Authentication

- [ ] **AUTH-01**: User can log in with email and password via Supabase Auth
- [ ] **AUTH-02**: User session persists across app restarts (offline-safe token storage)
- [ ] **AUTH-03**: User can log out from any screen
- [ ] **AUTH-04**: App detects user role (admin/tecnico) and shows appropriate navigation
- [ ] **AUTH-05**: Different users can log in on the same device

### Dashboard

- [ ] **DASH-01**: Technician sees list of assigned plantations after login
- [ ] **DASH-02**: Admin sees all plantations for the organization
- [ ] **DASH-03**: Each plantation shows total trees registered and synced
- [ ] **DASH-04**: Each plantation shows user's unsynced tree count
- [ ] **DASH-05**: Each plantation shows user's total tree count
- [ ] **DASH-06**: Each plantation shows user's trees registered today

### Plantation Management

- [ ] **PLAN-01**: Admin can create a plantation with lugar and periodo
- [ ] **PLAN-02**: Admin can select species from global catalog for a plantation
- [ ] **PLAN-03**: Admin can assign technicians to a plantation
- [ ] **PLAN-04**: Admin can add more species to a plantation after creation
- [ ] **PLAN-05**: Admin can define visual order of species buttons
- [ ] **PLAN-06**: Admin can finalize a plantation (when all SubGroups synced)

### SubGroup Management

- [ ] **SUBG-01**: Technician can create a SubGroup with name, code, and type (linea/parcela)
- [ ] **SUBG-02**: SubGroup code must be unique within the plantation
- [ ] **SUBG-03**: System shows last created SubGroup name when creating a new one
- [ ] **SUBG-04**: Technician can view list of SubGroups with state indicators (recording/finished/synced)
- [ ] **SUBG-05**: Technician can finalize a SubGroup (recording → finished)
- [ ] **SUBG-06**: Synced SubGroups are immutable (no edit allowed)
- [ ] **SUBG-07**: Technician can only edit SubGroups they created

### Tree Registration

- [ ] **TREE-01**: Technician sees species button grid when registering trees in a SubGroup
- [ ] **TREE-02**: One tap on a species button creates a tree record instantly (no confirmation)
- [ ] **TREE-03**: Tree position increments automatically within the SubGroup
- [ ] **TREE-04**: SubID generated automatically (SubGroupCode + SpeciesCode + Position)
- [ ] **TREE-05**: Last 3 registered trees displayed on registration screen
- [ ] **TREE-06**: Technician can attach optional photo to any tree (camera or gallery)
- [ ] **TREE-07**: Technician can delete the last registered tree (undo)

### N/N Workflow

- [ ] **NN-01**: Technician can register unidentified tree as N/N via dedicated button
- [ ] **NN-02**: Photo is mandatory when registering N/N tree
- [ ] **NN-03**: N/N resolution screen shows photo and species selector
- [ ] **NN-04**: Technician can resolve N/N by selecting correct species
- [ ] **NN-05**: SubGroup with unresolved N/N trees cannot be synced

### Reverse Order

- [ ] **REVR-01**: Technician can reverse tree order within a SubGroup
- [ ] **REVR-02**: Reverse recalculates all tree positions
- [ ] **REVR-03**: Reverse only allowed before SubGroup is synced

### Sync

- [ ] **SYNC-01**: Technician can manually initiate sync for finished SubGroups
- [ ] **SYNC-02**: Sync uploads SubGroup + all trees as atomic unit
- [ ] **SYNC-03**: Server rejects sync if SubGroup code already exists in plantation
- [ ] **SYNC-04**: Sync conflict shows clear error message to user
- [ ] **SYNC-05**: Successful sync marks SubGroup as synced (immutable)
- [ ] **SYNC-06**: During sync, app downloads updated data from other technicians
- [ ] **SYNC-07**: User can see list of SubGroups pending sync

### ID Generation

- [ ] **IDGN-01**: Admin triggers ID generation after plantation finalization
- [ ] **IDGN-02**: Plantation ID assigned sequentially within the plantation
- [ ] **IDGN-03**: Global Organization ID assigned sequentially across all plantations
- [ ] **IDGN-04**: Admin can set initial seed for Global Organization ID (system suggests n+1)

### Export

- [ ] **EXPO-01**: Admin can export finalized plantation to CSV
- [ ] **EXPO-02**: Admin can export finalized plantation to Excel
- [ ] **EXPO-03**: Export includes: ID Global, ID Parcial, Zona, SubGrupo, SubID, Periodo, Especie

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
| GPS per tree | GPS accuracy (±3-5m) meaningless at tree spacing (1-2m) |
| Species management from app | Species codes embedded in SubIDs; changes corrupt existing records |
| Confirmation dialogs on tree tap | Doubles registration time; unacceptable for field speed |
| Complex conflict resolution UI | Low conflict rate doesn't justify complexity; manual rename sufficient |
| AI species identification | Requires training data and connectivity; future consideration |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (populated during roadmap creation) | | |

**Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 0
- Unmapped: 44

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-16 after initial definition*
