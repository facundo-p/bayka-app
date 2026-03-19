# Phase 2: Field Registration - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Technicians can create SubGroups, register trees by tapping species buttons, handle N/N (unidentified) trees, reverse order, and finalize SubGroups — entirely offline. This phase delivers the core field workflow that is the reason the app exists. No sync, no dashboard stats, no admin features.

</domain>

<decisions>
## Implementation Decisions

### Species button grid
- 4-column scrollable grid, each button shows species code (large) + nombre (small)
- Minimum 60pt height per button, full column width — designed for gloved fingers
- N/N button fixed at the top of the grid, visually distinct (yellow/orange), always visible
- Species order defined by `orden_visual` from `plantation_species` table
- Grid loads species for the current plantation only (from local SQLite)

### Tree registration feedback
- One tap = one tree registered instantly — no confirmation dialog, no loading
- Brief visual flash/highlight on the tapped button
- Total tree count for the SubGroup displayed prominently at the top of the screen
- Last 3 registered trees shown above the species grid (position + species code, most recent first)
- Undo: tap the last tree in the last-3 list to delete it — instant, no confirmation

### SubGroup creation flow
- Tapping a plantation in the Plantaciones tab opens the SubGroup list for that plantation
- Create SubGroup form: Nombre, Código, Tipo (linea/parcela, default linea)
- Show the last created SubGroup name as reference when creating a new one
- SubGroup list shows state chips: Activa (green), Finalizada (orange), Sincronizada (blue)
- Tapping an activa SubGroup opens the tree registration screen

### SubGroup finalization
- "Finalizar" button at the bottom of the tree registration screen
- Finalization requires confirmation since it changes state (activa → finalizada)
- If SubGroup has unresolved N/N trees, finalization is blocked with clear message: "Resolver árboles N/N antes de finalizar"
- Finalized SubGroups are read-only in the list (no edit, no tree registration)
- Only the creator of a SubGroup can edit/finalize it

### N/N photo workflow
- Tapping N/N button opens camera immediately; secondary option to pick from gallery
- Photo is mandatory for N/N — registration fails without it
- Photo stored in local filesystem (documentDirectory), path saved in tree's foto_url field
- N/N resolution screen: full-screen photo with species picker overlay at bottom
- Navigate through unresolved N/N trees one by one
- N/N resolution accessible from SubGroup list (badge showing count of unresolved N/N)

### Reverse order
- Button on tree registration screen to reverse all tree positions within the SubGroup
- Only available when SubGroup estado is 'activa' (not finalizada or sincronizada)
- Recalculates positions: tree at position N goes to (total - N + 1)
- Requires confirmation: "¿Revertir el orden de los árboles?"

### Claude's Discretion
- Exact colors and styling for species buttons and state chips
- Animation details for button tap feedback
- Screen transition animations
- Error boundary and edge case handling details
- Exact layout proportions between grid, last-3 list, and counter

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Domain model and registration rules
- `docs/domain-model.md` §8 (SubGrupo) — SubGroup attributes, states, constraints
- `docs/domain-model.md` §9 (Árbol) — Tree attributes, SubID format, position rules
- `docs/domain-model.md` §10-11 (Posición, SubID) — Position auto-increment, SubID generation
- `docs/domain-model.md` §12 (N/N) — Unidentified tree rules, mandatory photo
- `docs/domain-model.md` §19 (Reglas de integridad) — Uniqueness constraints, sync gates

### Functional specs
- `docs/SPECS.md` §4.6 (Gestión de SubGrupos) — SubGroup creation, states, codes
- `docs/SPECS.md` §4.7 (Registro de Árboles) — Button-based registration, last 3 display
- `docs/SPECS.md` §4.8-4.9 (Datos de Árbol, SubID) — Tree data fields, SubID format
- `docs/SPECS.md` §4.10-4.11 (N/N) — N/N registration and resolution flow
- `docs/SPECS.md` §4.12 (Revertir Orden) — Reverse order rules
- `docs/SPECS.md` §4.13 (Fotos) — Camera/gallery, mandatory for N/N

### UI/UX constraints
- `docs/ui-ux-guidelines.md` §7 (Botonera de Especies) — Grid design, button size, max 20 species
- `docs/ui-ux-guidelines.md` §8 (Registro de Árboles) — Speed requirements, no confirmations
- `docs/ui-ux-guidelines.md` §9 (Revisión de N/N) — Simple flow: photo → selector → save → next

### Existing code (Phase 1)
- `mobile/src/database/schema.ts` — Drizzle schema with subgroups + trees tables
- `mobile/src/database/client.ts` — SQLite singleton with WAL mode
- `mobile/src/types/domain.ts` — Role, UserProfile, Session types (extend for SubGroup/Tree)
- `mobile/assets/species.json` — 10 seeded species
- `mobile/src/database/seeds/seedSpecies.ts` — Idempotent species seed pattern
- `mobile/app/(tecnico)/_layout.tsx` — Tecnico tab layout (Plantaciones + Perfil)
- `mobile/src/hooks/useAuth.ts` — Auth hook pattern to follow for new hooks

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mobile/src/database/schema.ts` — Drizzle schema already defines subgroups and trees tables
- `mobile/src/database/client.ts` — SQLite client with WAL mode, ready for queries
- `mobile/assets/species.json` — Species seed data with codigo, nombre, nombre_cientifico
- `mobile/src/hooks/useAuth.ts` — Hook pattern to follow for useSubGroups, useTrees hooks

### Established Patterns
- Layer architecture: UI (screens) → Hooks → Repositories → SQLite
- Drizzle ORM for all database access
- Spanish language for all UI text
- Expo Router file-based routing with layout groups
- SecureStore for encrypted local storage

### Integration Points
- `mobile/app/(tecnico)/plantaciones.tsx` — Currently placeholder, needs plantation list
- `mobile/app/(tecnico)/_layout.tsx` — Tab layout to navigate into plantation → subgroup → registration
- Drizzle `useLiveQuery` hook for reactive UI updates from local database writes
- `expo-image-picker` for camera/gallery access (not yet installed)

</code_context>

<specifics>
## Specific Ideas

- Registration must be FAST — one tap per tree, zero friction
- Species grid is the most important screen in the entire app
- Field conditions: gloves, sunlight, walking — big buttons, immediate feedback
- SubGroup creation should show last SubGroup name to help technicians maintain naming consistency
- N/N resolution should feel like a simple review workflow, not a complex form
- Follow the existing pattern: Spanish labels, simple screens, no unnecessary complexity

</specifics>

<deferred>
## Deferred Ideas

- Admin species button order configuration UI — Phase 4
- Dashboard stats (tree counts per plantation) — Phase 3
- Sync of SubGroups — Phase 3
- Photo upload to server — out of scope for MVP

</deferred>

---

*Phase: 02-field-registration*
*Context gathered: 2026-03-17*
