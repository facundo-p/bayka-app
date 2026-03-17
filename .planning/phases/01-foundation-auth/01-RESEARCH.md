# Phase 1: Foundation + Auth - Research

**Researched:** 2026-03-16
**Domain:** Expo SDK 55 + Drizzle ORM + expo-sqlite + Supabase Auth (offline-first React Native)
**Confidence:** HIGH — all core findings verified against prior project research (STACK.md, ARCHITECTURE.md, PITFALLS.md) which was sourced from official Expo, Drizzle, and Supabase docs

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Offline auth behavior**
- First login requires network connectivity to authenticate with Supabase
- Subsequent app opens use cached session from expo-secure-store — no network needed
- If Supabase token expires while offline, user continues working normally — soft warning only
- Re-authentication prompted only when user attempts sync (Phase 3)
- Cached sessions persist indefinitely while offline; token refreshed opportunistically when connectivity available
- If token refresh fails when online, show non-blocking toast and retry silently on next sync attempt

**Navigation shell**
- Bottom tab bar — field-friendly, thumb-reachable on mobile
- Technician tabs: Plantaciones (dashboard list) + Perfil (user info, logout)
- Admin tabs: Plantaciones (dashboard list) + Admin (create/manage plantations) + Perfil (user info, logout)
- Role detection on app start reads from cached user profile; redirects to appropriate tab layout
- Expo Router file-based routing with layout groups for role separation

**Database initialization**
- Splash screen with "Inicializando..." on first launch — no progress bar (migrations are fast)
- Migration failure shows error screen with "Contactar soporte" and technical details — rare but unrecoverable
- Species seed data bundled as JSON in app assets — loaded into SQLite on first launch, no network needed
- Schema designed to support species catalog updates via sync (Phase 3), but initial data is offline-only
- Drizzle ORM with `useMigrations` hook runs before any query on app startup
- SQLite WAL mode enabled for concurrent read/write performance

**Login screen UX**
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

### Deferred Ideas (OUT OF SCOPE)
- "Forgot password" flow — not needed for MVP with 4 seeded users
- Biometric login — future consideration
- Multi-language support — Spanish only for now
- User profile editing — not in Phase 1
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUN-01 | App bootstraps with Expo SDK 55, React Native, TypeScript | Standard Expo scaffolding — `create-expo-app` with TypeScript template |
| FOUN-02 | Local SQLite database initialized with Drizzle ORM schema and migrations | `useMigrations` hook from drizzle-orm/expo-sqlite/migrator; Metro .sql config required |
| FOUN-03 | Species catalog seeded into local database on first launch | JSON seed file bundled in assets; seeding logic runs after migrations succeed |
| FOUN-04 | Users seeded in Supabase (2 admin + 2 tecnico) | Supabase dashboard or SQL seed script via Supabase CLI; `auth.users` + custom `profiles` table |
| FOUN-05 | Supabase backend schema deployed (organizations, users, plantations, subgroups, trees, species) | Supabase migrations via SQL files; RLS policies applied per table |
| AUTH-01 | User can log in with email and password via Supabase Auth | `supabase.auth.signInWithPassword({ email, password })` — online only |
| AUTH-02 | User session persists across app restarts (offline-safe token storage) | expo-secure-store for token; custom offline session restoration on app launch |
| AUTH-03 | User can log out from any screen | `supabase.auth.signOut()` + clear expo-secure-store; navigate to login |
| AUTH-04 | App detects user role (admin/tecnico) and shows appropriate navigation | Role stored in cached user profile; Expo Router layout guards based on role |
| AUTH-05 | Different users can log in on the same device | Clear previous session on logout; re-auth stores new user token in expo-secure-store |
</phase_requirements>

---

## Summary

Phase 1 establishes all foundational infrastructure the app needs to run reliably in the field. This is the only phase that has no shortcuts available — a poorly implemented auth session or migration setup will cause failures in every subsequent phase and in production field use.

The critical challenge is the offline-safe auth session. Supabase's JS client auto-refreshes tokens on startup, which fails when offline and can silently log users out. The solution is to bypass the auto-refresh on offline launch and restore the session manually from expo-secure-store. This must be implemented correctly in Phase 1, not patched later.

The second critical challenge is the Drizzle migration setup. Metro must be configured to bundle `.sql` files, and `useMigrations` must complete before any SQLite query runs. If this is skipped or done incorrectly, the first app update in the field season will crash devices and require a re-install — losing unsynced data.

**Primary recommendation:** Implement offline auth session restoration and Drizzle migration infrastructure first, before writing any screens. All other Phase 1 work depends on these two pieces being correct.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo | SDK 55 | App framework, build tooling | React Native 0.83 + New Architecture default; Expo Router bundled |
| react-native | 0.83 (via Expo) | Mobile runtime | Included via Expo SDK 55; New Architecture is default |
| typescript | 5.x (via Expo) | Type safety | First-class Expo support; required for Drizzle schema inference |
| expo-router | ~4.x (via Expo SDK 55) | File-based navigation + layout groups | Built on React Navigation; typed routes; role-based layout groups |
| expo-sqlite | ~15.x (via Expo SDK 55) | Local SQLite persistence | Official Expo SQLite; WAL mode; Drizzle first-class integration |
| drizzle-orm | 0.45.x stable | Type-safe queries + migrations | `useMigrations` hook; `useLiveQuery`; runs natively in RN |
| @supabase/supabase-js | 2.99.x | Auth + backend calls | v2 stable; handles auth token, REST, RPC |
| expo-secure-store | ~14.x (via Expo SDK 55) | Encrypted token storage | iOS Keychain / Android Keystore; correct for JWT tokens |
| @react-native-async-storage/async-storage | 2.x | Supabase session fallback storage | Required by supabase-js in RN environments |
| react-native-url-polyfill | 2.x | URL API polyfill | Required by supabase-js; must be first import in entry file |

### Supporting (Phase 1)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-kit | 0.28.x (dev only) | Migration file generation CLI | Run locally after schema changes; output bundled into app |
| expo-drizzle-studio-plugin | latest | In-app DB inspector | Dev only; add as plugin in app.json |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| expo-secure-store | AsyncStorage for tokens | AsyncStorage is unencrypted — never use for JWTs |
| drizzle-orm | WatermelonDB | WatermelonDB adds sync complexity Bayka doesn't need |
| Expo Router layout groups | React Navigation bare | Expo Router is the standard for new Expo projects |

### Installation

```bash
# Create project
npx create-expo-app@latest bayka-app --template

# Core DB + ORM
npx expo install expo-sqlite drizzle-orm

# Supabase client + required polyfills
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill expo-secure-store

# Dev tools
npm install -D drizzle-kit

# Optional: DB inspector (dev only)
npx expo install expo-drizzle-studio-plugin
```

---

## Architecture Patterns

### Recommended Project Structure

```
bayka-app/
├── app/                          # Expo Router file-based routing
│   ├── _layout.tsx               # Root layout: migrations, auth guard
│   ├── (auth)/
│   │   └── login.tsx             # Login screen
│   ├── (tecnico)/
│   │   ├── _layout.tsx           # Tecnico tab layout (2 tabs)
│   │   ├── plantaciones.tsx      # Plantation list
│   │   └── perfil.tsx            # Profile + logout
│   └── (admin)/
│       ├── _layout.tsx           # Admin tab layout (3 tabs)
│       ├── plantaciones.tsx      # All plantations
│       ├── admin.tsx             # Admin panel
│       └── perfil.tsx            # Profile + logout
│
├── src/
│   ├── database/
│   │   ├── schema.ts             # Drizzle table definitions (source of truth)
│   │   ├── client.ts             # SQLite singleton + WAL mode pragma
│   │   └── seeds/
│   │       └── species.json      # Species seed data (bundled in assets)
│   │
│   ├── repositories/
│   │   └── SpeciesRepository.ts  # Phase 1: only species needed
│   │
│   ├── supabase/
│   │   ├── client.ts             # Supabase client init (offline-aware)
│   │   └── auth.ts               # Session restoration, logout helpers
│   │
│   ├── hooks/
│   │   └── useAuth.ts            # Auth state, role detection, session
│   │
│   ├── components/
│   │   └── LoadingScreen.tsx     # "Inicializando..." splash
│   │
│   └── types/
│       └── domain.ts             # User, Role, Session types
│
├── drizzle/                      # Auto-generated SQL migration files
└── metro.config.js               # .sql file bundling config
```

### Pattern 1: Root Layout as Migration + Auth Gate

The root `_layout.tsx` is the entry point for the app. It runs Drizzle migrations first, then checks auth state, then routes to the appropriate layout group. No screen renders until migrations complete.

```typescript
// app/_layout.tsx
import 'react-native-url-polyfill/auto'; // MUST be first import

import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import { db } from '../src/database/client';
import { useAuth } from '../src/hooks/useAuth';

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const { session, role, loading } = useAuth();

  if (!success) {
    if (error) return <MigrationErrorScreen error={error} />;
    return <LoadingScreen message="Inicializando..." />;
  }

  if (loading) return <LoadingScreen message="Iniciando sesión..." />;

  if (!session) return <Redirect href="/(auth)/login" />;

  if (role === 'admin') return <Redirect href="/(admin)/plantaciones" />;
  return <Redirect href="/(tecnico)/plantaciones" />;
}
```

**Source:** ARCHITECTURE.md — Build Order; PITFALLS.md — Pitfall 4 (migrations must run before any query)

### Pattern 2: Offline-Safe Supabase Client

The Supabase client must not auto-refresh the session on launch when offline. Session is stored in expo-secure-store and restored manually.

```typescript
// src/supabase/client.ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,    // keep true but handle failures gracefully
      persistSession: true,
      detectSessionInUrl: false, // required for React Native
    },
  }
);
```

```typescript
// src/supabase/auth.ts — offline session restoration
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';

const SESSION_KEY = 'supabase_session';

export async function restoreSession() {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;

  const session = JSON.parse(raw);
  const net = await NetInfo.fetch();

  if (!net.isConnected) {
    // Offline: return cached session without refresh attempt
    return session;
  }

  // Online: let Supabase validate and refresh
  const { data, error } = await supabase.auth.setSession(session);
  if (error) {
    // Token unrecoverable — clear and force re-login
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
  return data.session;
}

export async function persistSession(session: Session) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
```

**Source:** PITFALLS.md — Pitfall 1 (auth session expiry kills offline use)

### Pattern 3: SQLite Client with WAL Mode

WAL mode must be enabled immediately after opening the database connection, before any queries.

```typescript
// src/database/client.ts
import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const sqlite = SQLite.openDatabaseSync('bayka.db');

// Enable WAL mode for concurrent read/write performance
sqlite.execSync('PRAGMA journal_mode=WAL;');

export const db = drizzle(sqlite, { schema });
```

**Source:** PITFALLS.md — Performance Traps (no WAL mode); STACK.md — Supporting Libraries

### Pattern 4: Metro Config for SQL Bundling

Without this, Drizzle cannot find migration files in the production bundle. This is not optional.

```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql');
module.exports = config;
```

**Source:** STACK.md — Installation; PITFALLS.md — Pitfall 4

### Pattern 5: Species Seeding on First Launch

Seed runs after `useMigrations` succeeds. Check a flag in SQLite before inserting to make seeding idempotent.

```typescript
// src/database/seeds/seedSpecies.ts
import speciesData from '../../assets/species.json';
import { db } from '../client';
import { species } from '../schema';
import { count } from 'drizzle-orm';

export async function seedSpeciesIfNeeded() {
  const [result] = await db.select({ count: count() }).from(species);
  if (result.count > 0) return; // Already seeded

  await db.insert(species).values(
    speciesData.map(s => ({
      id: s.id,
      codigo: s.codigo,
      nombre: s.nombre,
      nombreCientifico: s.nombre_cientifico ?? null,
    }))
  );
}
```

**Source:** CONTEXT.md — Database initialization decisions

### Pattern 6: Role-Based Navigation with Expo Router Layout Groups

Role is read from the cached user profile stored in SecureStore, not from a live Supabase query (to remain offline-safe).

```
app/
├── (auth)/login.tsx          → no auth required
├── (tecnico)/_layout.tsx     → tab bar with 2 tabs
└── (admin)/_layout.tsx       → tab bar with 3 tabs
```

The root layout redirects based on role after session restoration. Layout groups enforce tab structure per role.

**Source:** CONTEXT.md — Navigation shell decisions; ARCHITECTURE.md — Auth Flow

### Anti-Patterns to Avoid

- **Auto-refresh on offline launch:** Never call `supabase.auth.getSession()` unconditionally on startup — it triggers a network refresh that fails offline and evicts the session.
- **Importing Drizzle in screens directly:** All SQLite access goes through repository functions, never raw Drizzle in a screen component.
- **Blocking migration errors:** If `useMigrations` returns an error, show an error screen and stop. Do not attempt to use the database in a broken migration state.
- **AsyncStorage for auth tokens:** expo-secure-store is mandatory for JWT tokens (encrypted via OS keychain/keystore).
- **Hardcoding Supabase credentials in source:** Use `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` environment variables in `.env`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite migrations | Custom migration runner | `drizzle-orm/expo-sqlite/migrator` `useMigrations` hook | Handles migration ordering, tracking, atomicity; 1 line of code |
| Encrypted token storage | Custom encryption layer | `expo-secure-store` | OS-level keychain/keystore encryption; 2048 byte limit to manage |
| Session persistence | Custom serialization | Supabase client `persistSession: true` + AsyncStorage | Handles token refresh, serialization, deserialization |
| File-based routing + auth guards | Custom navigator logic | Expo Router layout groups + redirects | Layout files are the guard; redirect in root `_layout.tsx` |
| WAL mode setup | Manual SQLite pragmas in multiple places | Single `PRAGMA journal_mode=WAL` in `client.ts` | One place, runs once on DB open |

**Key insight:** Every item in this list looks simple to build and hides significant edge cases. Drizzle migrations alone handle: ordering, idempotency, migration tracking table, rollback on failure. Custom solutions will miss these.

---

## Common Pitfalls

### Pitfall 1: Offline Session Eviction (Critical)

**What goes wrong:** Supabase client calls token refresh endpoint on startup; fails when offline; logs user out. User arrives at plantation with no connectivity and cannot access the app.

**Why it happens:** `autoRefreshToken: true` fires immediately on client creation, regardless of connectivity.

**How to avoid:** On app launch, check connectivity before calling any Supabase auth method. If offline, restore session directly from expo-secure-store without triggering a network refresh. See Pattern 2 above.

**Warning signs:** Users report being logged out after arriving at remote sites with no connectivity.

**Verified by:** PITFALLS.md Pitfall 1; supabase/auth-js Issue #226; Supabase Discussion #36906

### Pitfall 2: Missing Metro .sql Config

**What goes wrong:** `useMigrations` throws at runtime: "Cannot find module './migrations'". The `.sql` files are not bundled because Metro does not know to include them.

**Why it happens:** Metro's default config does not include `.sql` as a recognized source extension.

**How to avoid:** Add `config.resolver.sourceExts.push('sql')` to `metro.config.js` before running the first build.

**Warning signs:** Migrations work in dev with Metro but fail in production EAS build.

### Pitfall 3: SQLite Queries Before Migration Completes

**What goes wrong:** A component mounts and queries the DB before `useMigrations` has finished. If the schema has changed since the last install, the query hits a missing column and crashes.

**Why it happens:** Component tree renders before root layout has gated on migration completion.

**How to avoid:** Root `_layout.tsx` renders `null` or a loading screen until `useMigrations` returns `success: true`. No child routes render until then.

### Pitfall 4: expo-secure-store 2048 Byte Limit

**What goes wrong:** Storing the entire Supabase session object (which can include `user` metadata, provider tokens, etc.) in a single SecureStore entry fails silently or throws a size error.

**Why it happens:** expo-secure-store enforces a 2048 byte maximum value size per key.

**How to avoid:** Store only the access token and refresh token separately (two keys), or store a compact JSON with only the fields needed for session restoration.

### Pitfall 5: Role Stored Only in Supabase JWT (Not Locally Cached)

**What goes wrong:** App launches offline; tries to read role from JWT claims; `supabase.auth.getUser()` requires a network call; fails; navigation cannot determine which tab layout to show.

**Why it happens:** Role detection is implemented as a live Supabase query rather than reading from cached local state.

**How to avoid:** After successful login, store the user's role in expo-secure-store alongside the session token. On subsequent launches (including offline), role is read from local storage — no network call needed.

### Pitfall 6: Supabase Seed Users Not in Custom Profile Table

**What goes wrong:** User authenticates via `supabase.auth.signInWithPassword()` — success. But the app queries a `profiles` table to get the role, which is empty. Role detection fails; user sees wrong navigation or a crash.

**Why it happens:** Seeding users in Supabase Auth (`auth.users`) is separate from seeding a custom `profiles` table. The seed script must do both.

**How to avoid:** Supabase seed SQL must: (1) insert into `auth.users` via Supabase admin client or raw SQL, (2) insert corresponding rows into the `profiles` table with `role` field, (3) insert into the `organization_users` join table for the Bayka organization.

---

## Code Examples

### drizzle.config.ts

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/database/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
```

### Phase 1 Drizzle Schema (Foundation Tables)

```typescript
// src/database/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const species = sqliteTable('species', {
  id: text('id').primaryKey(),
  codigo: text('codigo').notNull().unique(),
  nombre: text('nombre').notNull(),
  nombreCientifico: text('nombre_cientifico'),
  createdAt: text('created_at').notNull(),
});

// Phase 1 also needs these tables defined even if not fully used yet,
// because the full schema must be migration-ready for Phase 2+
export const plantations = sqliteTable('plantations', {
  id: text('id').primaryKey(),
  organizacionId: text('organizacion_id').notNull(),
  lugar: text('lugar').notNull(),
  periodo: text('periodo').notNull(),
  estado: text('estado').notNull().default('activa'), // activa | finalizada
  creadoPor: text('creado_por').notNull(),
  createdAt: text('created_at').notNull(),
});

export const subgroups = sqliteTable('subgroups', {
  id: text('id').primaryKey(),
  plantacionId: text('plantacion_id').notNull().references(() => plantations.id),
  nombre: text('nombre').notNull(),
  codigo: text('codigo').notNull(),
  tipo: text('tipo').notNull().default('linea'), // linea | parcela
  estado: text('estado').notNull().default('activa'), // activa | finalizada | sincronizada
  usuarioCreador: text('usuario_creador').notNull(),
  createdAt: text('created_at').notNull(),
});

export const trees = sqliteTable('trees', {
  id: text('id').primaryKey(),
  subgrupoId: text('subgrupo_id').notNull().references(() => subgroups.id),
  especieId: text('especie_id').references(() => species.id), // null = N/N
  posicion: integer('posicion').notNull(),
  subId: text('sub_id').notNull(),
  fotoUrl: text('foto_url'),
  plantacionId: integer('plantacion_id'),
  globalId: integer('global_id'),
  usuarioRegistro: text('usuario_registro').notNull(),
  createdAt: text('created_at').notNull(),
});
```

### Supabase Backend Schema (Postgres)

```sql
-- organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);

-- profiles (extends auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol text not null check (rol in ('admin', 'tecnico')),
  organizacion_id uuid references organizations(id),
  created_at timestamptz not null default now()
);

-- species (global catalog)
create table species (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  nombre_cientifico text,
  created_at timestamptz not null default now()
);

-- plantations
create table plantations (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizations(id),
  lugar text not null,
  periodo text not null,
  estado text not null default 'activa' check (estado in ('activa', 'finalizada')),
  creado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- plantation_species (which species appear in a plantation's UI)
create table plantation_species (
  plantation_id uuid not null references plantations(id),
  species_id uuid not null references species(id),
  orden_visual integer not null default 0,
  primary key (plantation_id, species_id)
);

-- plantation_users (technicians assigned to plantations)
create table plantation_users (
  plantation_id uuid not null references plantations(id),
  user_id uuid not null references auth.users(id),
  rol_en_plantacion text not null default 'tecnico',
  assigned_at timestamptz not null default now(),
  primary key (plantation_id, user_id)
);

-- subgroups
create table subgroups (
  id uuid primary key default gen_random_uuid(),
  plantation_id uuid not null references plantations(id),
  nombre text not null,
  codigo text not null,
  tipo text not null default 'linea' check (tipo in ('linea', 'parcela')),
  estado text not null default 'activa' check (estado in ('activa', 'finalizada', 'sincronizada')),
  usuario_creador uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (plantation_id, codigo)  -- uniqueness constraint
);

-- trees
create table trees (
  id uuid primary key default gen_random_uuid(),
  subgroup_id uuid not null references subgroups(id),
  species_id uuid references species(id),  -- null = N/N
  posicion integer not null,
  sub_id text not null,
  foto_url text,
  plantacion_id integer,
  global_id integer,
  usuario_registro uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
```

### Supabase User Seeding (SQL)

```sql
-- Run via Supabase dashboard SQL editor or supabase/seed.sql
-- Step 1: Create organization
insert into organizations (id, nombre)
values ('00000000-0000-0000-0000-000000000001', 'Bayka');

-- Step 2: Create users via Supabase Auth API (use admin client, not raw SQL)
-- Use supabase.auth.admin.createUser() in a seed script:
-- { email: 'admin1@bayka.org', password: '...', email_confirm: true }
-- { email: 'admin2@bayka.org', password: '...', email_confirm: true }
-- { email: 'tecnico1@bayka.org', password: '...', email_confirm: true }
-- { email: 'tecnico2@bayka.org', password: '...', email_confirm: true }

-- Step 3: After user creation, insert profiles
insert into profiles (id, nombre, rol, organizacion_id)
values
  ('<admin1_uid>', 'Admin 1', 'admin', '00000000-0000-0000-0000-000000000001'),
  ('<admin2_uid>', 'Admin 2', 'admin', '00000000-0000-0000-0000-000000000001'),
  ('<tecnico1_uid>', 'Técnico 1', 'tecnico', '00000000-0000-0000-0000-000000000001'),
  ('<tecnico2_uid>', 'Técnico 2', 'tecnico', '00000000-0000-0000-0000-000000000001');
```

### useAuth Hook (Offline-Safe)

```typescript
// src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { restoreSession, persistSession, clearSession } from '../supabase/auth';
import * as SecureStore from 'expo-secure-store';

const ROLE_KEY = 'user_role';
const EMAIL_KEY = 'last_email';

export function useAuth() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState<'admin' | 'tecnico' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const restored = await restoreSession();
      if (restored) {
        setSession(restored);
        const cachedRole = await SecureStore.getItemAsync(ROLE_KEY);
        setRole(cachedRole as 'admin' | 'tecnico');
      }
      setLoading(false);
    })();

    // Listen for auth changes (when online)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          await persistSession(session);
          // Fetch role from profiles table (online) and cache it
          const { data: profile } = await supabase
            .from('profiles')
            .select('rol')
            .eq('id', session.user.id)
            .single();
          if (profile) {
            await SecureStore.setItemAsync(ROLE_KEY, profile.rol);
            await SecureStore.setItemAsync(EMAIL_KEY, session.user.email ?? '');
            setRole(profile.rol);
          }
          setSession(session);
        } else if (event === 'SIGNED_OUT') {
          await clearSession();
          await SecureStore.deleteItemAsync(ROLE_KEY);
          setSession(null);
          setRole(null);
        }
        // SIGNED_IN_OFFLINE and TOKEN_REFRESHED are handled by restoreSession
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { session, role, loading, signIn, signOut };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AsyncStorage for auth tokens | expo-secure-store (encrypted) | Supabase Expo guides updated 2024 | Security improvement; no behavior change |
| expo-sqlite legacy API | New expo-sqlite API with `openDatabaseSync` | Expo SDK 51+ | Synchronous open; WAL support; Drizzle integration |
| Manual SQL migrations in RN | Drizzle `useMigrations` hook | Drizzle ORM 0.40+ | Zero-boilerplate migrations in managed Expo |
| React Navigation bare setup | Expo Router file-based routing | Expo SDK 50+ | Typed routes; layout groups for auth patterns |
| `persistSession: true` alone | `persistSession: true` + offline restoration pattern | Supabase auth-js v2 | Required for offline-first apps |

**Deprecated/outdated:**
- `expo-sqlite@next` tag: Pre-release tag from older Drizzle docs — SDK 55 ships the modern API as stable. Use `npx expo install expo-sqlite`.
- Drizzle ORM v1.0-beta: Breaking changes still possible. Use 0.45.x stable.
- Expo Go for development: SDK 55 with expo-sqlite and expo-secure-store requires a development build.

---

## Open Questions

1. **Supabase user seeding method**
   - What we know: Supabase does not allow raw SQL inserts into `auth.users` via normal SQL access
   - What's unclear: Whether seeding uses the Supabase admin client SDK (Node.js script), the Supabase dashboard, or `supabase/seed.sql` with Supabase CLI
   - Recommendation: Plan a dedicated "Supabase setup" task (FOUN-04/05) that uses `supabase.auth.admin.createUser()` in a Node.js seed script; document the 4 test users and their credentials in a `.env.seed` file not committed to git

2. **expo-secure-store 2048 byte limit and session object size**
   - What we know: Supabase sessions include access_token, refresh_token, user object, provider_token
   - What's unclear: Whether the full session JSON exceeds 2048 bytes in practice
   - Recommendation: In the implementation task, measure the actual session JSON size after first login. If it exceeds the limit, store access_token and refresh_token in separate SecureStore keys; store role and email separately.

3. **Network connectivity detection library**
   - What we know: The offline session restoration pattern requires checking connectivity before Supabase auth calls
   - What's unclear: Whether `@react-native-community/netinfo` is already bundled with Expo SDK 55 or needs separate install
   - Recommendation: Use `NetInfo.fetch()` from `@react-native-community/netinfo`; confirm via `npx expo install @react-native-community/netinfo` during implementation.

---

## Validation Architecture

nyquist_validation is enabled. This is a greenfield project with no existing test infrastructure.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest + jest-expo (bundled with Expo) |
| Config file | None — Wave 0 creates `jest.config.js` |
| Quick run command | `npx jest --testPathPattern="unit" --passWithNoTests` |
| Full suite command | `npx jest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUN-01 | Project bootstraps with TypeScript | smoke | `npx tsc --noEmit` | ❌ Wave 0 |
| FOUN-02 | Drizzle migrations run without error | unit | `npx jest tests/database/migrations.test.ts -x` | ❌ Wave 0 |
| FOUN-03 | Species seed inserts correct count and data | unit | `npx jest tests/database/seed.test.ts -x` | ❌ Wave 0 |
| FOUN-04 | Supabase users exist with correct roles | manual-only | Manual: login with each seeded user credential | N/A |
| FOUN-05 | Supabase schema tables exist with correct constraints | manual-only | Manual: verify via Supabase dashboard or `psql` | N/A |
| AUTH-01 | Login with valid credentials returns session | integration | `npx jest tests/auth/login.test.ts -x` (requires Supabase test project) | ❌ Wave 0 |
| AUTH-02 | Session survives app restart (SecureStore restore) | unit | `npx jest tests/auth/session.test.ts -x` | ❌ Wave 0 |
| AUTH-03 | Logout clears SecureStore and session state | unit | `npx jest tests/auth/logout.test.ts -x` | ❌ Wave 0 |
| AUTH-04 | Role detection reads from cache, not network | unit | `npx jest tests/auth/role.test.ts -x` | ❌ Wave 0 |
| AUTH-05 | Second login on same device stores new user session | unit | `npx jest tests/auth/multiuser.test.ts -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit` (type check only — fast)
- **Per wave merge:** `npx jest tests/unit --passWithNoTests`
- **Phase gate:** Full `npx jest` green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `jest.config.js` — jest-expo preset configuration
- [ ] `tests/setup.ts` — shared mocks for expo-secure-store, NetInfo, expo-sqlite
- [ ] `tests/database/migrations.test.ts` — covers FOUN-02
- [ ] `tests/database/seed.test.ts` — covers FOUN-03
- [ ] `tests/auth/session.test.ts` — covers AUTH-02
- [ ] `tests/auth/logout.test.ts` — covers AUTH-03
- [ ] `tests/auth/role.test.ts` — covers AUTH-04
- [ ] `tests/auth/multiuser.test.ts` — covers AUTH-05
- [ ] Framework install: `npx expo install jest-expo` — not yet installed

Note: FOUN-04, FOUN-05, and AUTH-01 require a live Supabase project. Mark as manual-only for the phase gate; the Supabase setup task itself constitutes verification.

---

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — Expo SDK 55, Drizzle ORM, expo-sqlite, Supabase client versions and setup
- `.planning/research/ARCHITECTURE.md` — Layer architecture, auth flow, project structure
- `.planning/research/PITFALLS.md` — Offline auth pitfall (Pitfall 1), migration setup (Pitfall 4), WAL mode
- `docs/architecture.md` — Official project architecture decisions (stack, structure, layers)
- `docs/domain-model.md` — Entity definitions, attributes, relationships for schema design
- `docs/SPECS.md §4.1` — Auth requirements, session persistence, multi-user device support
- `docs/SPECS.md §4.2` — Post-login view requirements (dashboard)

### Secondary (MEDIUM confidence)
- Supabase Expo React Native quickstart — required packages verified against this guide
- Drizzle ORM Expo SQLite connect guide — `useMigrations` API verified

### Tertiary (LOW confidence — needs validation)
- expo-secure-store 2048 byte limit behavior with full Supabase session objects — measure during implementation
- NetInfo availability in Expo SDK 55 — confirm via `npx expo install`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions sourced from STACK.md which cited official Expo, Drizzle, and Supabase docs
- Architecture: HIGH — patterns sourced from ARCHITECTURE.md and PITFALLS.md with official source backing
- Pitfalls: HIGH — all pitfalls from PITFALLS.md are verified against GitHub issues and official docs
- Supabase schema: HIGH — derived directly from domain-model.md
- Test infrastructure: MEDIUM — jest-expo is the standard but no project infrastructure exists yet to confirm

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable stack; SDK 55 release cadence is quarterly)
