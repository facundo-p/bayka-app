# Phase 1: Foundation + Auth - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

The app runs offline-safely with working auth, a migration-ready SQLite schema, and role-based navigation that persists across restarts. This phase delivers the infrastructure skeleton — no feature screens beyond login and navigation shell.

</domain>

<decisions>
## Implementation Decisions

### Offline auth behavior
- First login requires network connectivity to authenticate with Supabase
- Subsequent app opens use cached session from expo-secure-store — no network needed
- If Supabase token expires while offline, user continues working normally — soft warning only
- Re-authentication prompted only when user attempts sync (Phase 3)
- Cached sessions persist indefinitely while offline; token refreshed opportunistically when connectivity available
- If token refresh fails when online, show non-blocking toast and retry silently on next sync attempt

### Navigation shell
- Bottom tab bar — field-friendly, thumb-reachable on mobile
- Technician tabs: Plantaciones (dashboard list) + Perfil (user info, logout)
- Admin tabs: Plantaciones (dashboard list) + Admin (create/manage plantations) + Perfil (user info, logout)
- Role detection on app start reads from cached user profile; redirects to appropriate tab layout
- Expo Router file-based routing with layout groups for role separation

### Database initialization
- Splash screen with "Inicializando..." on first launch — no progress bar (migrations are fast)
- Migration failure shows error screen with "Contactar soporte" and technical details — rare but unrecoverable
- Species seed data bundled as JSON in app assets — loaded into SQLite on first launch, no network needed
- Schema designed to support species catalog updates via sync (Phase 3), but initial data is offline-only
- Drizzle ORM with `useMigrations` hook runs before any query on app startup
- SQLite WAL mode enabled for concurrent read/write performance

### Login screen UX
- Simple centered form: app logo, email field, password field, login button
- Pre-fill email from last successful login (stored in secure storage)
- Error messages inline in red below form — in Spanish: "Email o contraseña incorrectos"
- App language: Spanish (target users are Spanish-speaking field technicians in Argentina)
- No "forgot password" in Phase 1 — users are seeded, admin can reset via Supabase dashboard

### Claude's Discretion
- Exact splash screen design and loading animation
- Typography and spacing choices
- Expo Router file structure organization
- Error boundary implementation details
- Exact tab bar icons

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Domain model and data schema
- `docs/domain-model.md` — Entity definitions, attributes, relationships, cardinalities, integrity rules
- `docs/architecture.md` §2 (Stack Tecnológico) — Tech stack decisions
- `docs/architecture.md` §4 (Componentes del Sistema) — System component responsibilities
- `docs/architecture.md` §8 (Estructura del Proyecto) — Recommended project directory structure
- `docs/architecture.md` §9 (Capas de Arquitectura) — Layer architecture (UI → Hooks → Repositories → SQLite)

### Authentication
- `docs/SPECS.md` §4.1 (Autenticación de Usuarios) — Auth requirements, session persistence, multi-user device support
- `docs/SPECS.md` §4.2 (Dashboard) — Post-login view requirements

### UI/UX constraints
- `docs/ui-ux-guidelines.md` — Field-optimized UI principles, button sizes, feedback patterns, simplicity rules

### Research findings
- `.planning/research/STACK.md` — Expo SDK 55, Drizzle ORM, expo-sqlite, Supabase client details
- `.planning/research/ARCHITECTURE.md` — Layer architecture, offline-first patterns
- `.planning/research/PITFALLS.md` — Auth offline bug, migration setup, WAL mode requirements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None — this phase establishes the foundational patterns for the entire project

### Integration Points
- Supabase project (to be created or connected) — auth and backend database
- Species seed data file (to be created) — JSON bundled in app assets

</code_context>

<specifics>
## Specific Ideas

- App must feel instant on startup — no long loading screens
- Login form should be dead simple: email + password + button, nothing else
- Navigation must be obvious — technicians should land on their plantations immediately after login
- Spanish language throughout — "Plantaciones", "Perfil", "Iniciar sesión", etc.
- Follow the layer architecture from docs/architecture.md: UI → Hooks → Repositories → SQLite

</specifics>

<deferred>
## Deferred Ideas

- "Forgot password" flow — not needed for MVP with 4 seeded users
- Biometric login — future consideration
- Multi-language support — Spanish only for now
- User profile editing — not in Phase 1

</deferred>

---

*Phase: 01-foundation-auth*
*Context gathered: 2026-03-16*
