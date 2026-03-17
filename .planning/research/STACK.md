# Stack Research

**Domain:** Offline-first field data collection mobile app (React Native / Expo)
**Researched:** 2026-03-16
**Confidence:** MEDIUM-HIGH (core stack HIGH, sync pattern MEDIUM)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Expo | SDK 55 (stable, March 2026) | App framework and build tooling | Official React Native recommendation; managed workflow eliminates native config complexity; SDK 55 includes React Native 0.83 + React 19.2; New Architecture is default |
| React Native | 0.83 (via Expo SDK 55) | Mobile runtime | Included via Expo; New Architecture default in SDK 55 removes legacy bridge |
| TypeScript | 5.x (bundled with Expo) | Type safety | First-class Expo support; Drizzle ORM schema definitions require TypeScript for correctness |
| Expo Router | ~4.x (bundled with Expo SDK 55) | File-based navigation | Built on React Navigation; file-based routing reduces nav boilerplate; typed routes; recommended for new Expo projects |
| expo-sqlite | ~15.x (bundled with Expo SDK 55) | Local SQLite database | Official Expo SQLite package; persists across restarts; supports transactions, prepared statements, and the Session Extension for changeset-based sync; Drizzle ORM integration is first-class |
| Drizzle ORM | 0.45.x stable (v1.0 beta exists, avoid) | Type-safe SQL query builder + migrations | Runs natively on React Native without a server; generates .sql migrations bundled into app binary; `useLiveQuery` hook auto-updates UI on data change; Drizzle Studio plugin for in-app DB inspection; the standard choice for expo-sqlite in 2025–2026 |
| @supabase/supabase-js | 2.99.x | Supabase client (auth + DB calls) | v2 is stable and actively maintained; handles auth, RPC calls, and REST queries; used for manual sync push/pull to Supabase backend |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expo-image-picker | ~16.x (SDK 55) | Camera capture and gallery selection | Used for optional tree photos; handles permissions declaratively; supports both camera and library sources in one API |
| expo-file-system | ~18.x (SDK 55) | Local file storage | Store captured photos in app's document directory (persists across restarts, safe from OS deletion); Phase 1 photos stay local-only |
| expo-secure-store | ~14.x (SDK 55) | Encrypted key-value storage | Store Supabase auth tokens securely (uses iOS Keychain / Android Keystore); better than AsyncStorage for credentials |
| @react-native-async-storage/async-storage | 2.x | Non-sensitive persistence | Required by @supabase/supabase-js as session storage fallback; also usable for app preferences |
| react-native-url-polyfill | 2.x | URL API polyfill | Required by @supabase/supabase-js in React Native environments; must be imported at app entry point |
| Zustand | 5.x | Client UI state management | Lightweight, hook-based; no boilerplate vs Redux; persist middleware works with AsyncStorage for offline state; use for UI state (current plantation, active SubGroup, sync status) — NOT for persisting domain data (that lives in SQLite) |
| drizzle-kit | 0.28.x (dev only) | Migration generation CLI | Generates .sql migration files from Drizzle schema; files must be bundled into app via Metro config; run on device at startup via `useMigrations` hook |
| react-native-url-polyfill | 2.x | URL global polyfill for Supabase | Import as first line of entry file: `import 'react-native-url-polyfill/auto'` |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Expo Go / Dev Build | Local development and testing | SDK 55 requires a dev build (not Expo Go) for full SQLite + secure store support; use `npx expo run:ios` or EAS Build |
| EAS Build | Cloud build service | Required for production builds targeting iOS/Android; configure with `eas.json` |
| Drizzle Studio (Expo plugin) | In-app database browser | Add `expo-drizzle-studio-plugin` as dev plugin in `app.json`; provides browser-based DB inspection at runtime |
| drizzle-kit generate | Migration generation | Run locally during development; output goes to `/drizzle` folder; Metro must be configured to bundle `.sql` files as strings |

---

## Installation

```bash
# Create project with Expo SDK 55
npx create-expo-app@latest bayka-app --template

# Core dependencies
npx expo install expo-sqlite drizzle-orm zustand

# Supabase client and its required polyfills
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill expo-secure-store

# Media and file system
npx expo install expo-image-picker expo-file-system expo-camera

# Dev dependencies
npm install -D drizzle-kit

# Optional: Drizzle Studio for development
npx expo install expo-drizzle-studio-plugin
```

**Metro config for SQL file bundling (required for Drizzle migrations):**

```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql');
module.exports = config;
```

**drizzle.config.ts:**

```typescript
import type { Config } from 'drizzle-kit';
export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| expo-sqlite + Drizzle ORM | WatermelonDB | When you need built-in reactive sync engine with a Supabase backend and are willing to learn WatermelonDB's non-standard API. For Bayka, manual sync is simpler and WatermelonDB adds unnecessary complexity. |
| expo-sqlite + Drizzle ORM | op-sqlite (OP-SQLite) | When raw SQLite performance is critical (10x faster than expo-sqlite in benchmarks). For Bayka's scale (~thousands of trees), expo-sqlite performance is sufficient; op-sqlite requires bare workflow or custom dev client. |
| expo-sqlite + Drizzle ORM | PowerSync | When you need automatic bi-directional real-time sync out of the box. Bayka explicitly requires manual sync only — PowerSync is overengineered for this. Also adds a third-party SaaS dependency. |
| expo-sqlite + Drizzle ORM | RxDB | When you need reactive NoSQL with multiple replication plugins. SQL schema is a better fit for Bayka's structured domain model (Organization → Plantations → SubGroups → Trees). |
| expo-image-picker | expo-camera (direct) | When you need fine-grained camera control (custom shutter UI, real-time preview, video). For simple photo capture + gallery, expo-image-picker is higher level and requires less code. |
| Zustand | Redux Toolkit | When team already uses Redux or needs devtools for complex async state. For this project, Zustand's minimal API is sufficient and reduces boilerplate. |
| Zustand | React Context | When state is genuinely local to a component subtree. Context is acceptable for auth session; use Zustand for cross-cutting UI state. |
| Expo Router | React Navigation (bare) | When you need non-file-based routing or a bare React Native project. Expo Router is built on React Navigation and is the default for new Expo apps. |
| EAS Build | Local native builds | When you need a CI/CD pipeline or don't want to manage Xcode/Android Studio. For Phase 1 targeting a small team, EAS Build free tier is sufficient. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| AsyncStorage for auth tokens | Stores data unencrypted; any file system access can read it; JWT tokens are security-sensitive | expo-secure-store (encrypted via OS keychain/keystore) |
| `expo-sqlite@next` tag in production | The `@next` tag in Drizzle's older docs referred to a pre-release expo-sqlite; SDK 55 ships the modern API as stable — use the version bundled with Expo SDK via `npx expo install` | `npx expo install expo-sqlite` (lets Expo resolve the correct version) |
| Drizzle ORM v1.0.0-beta.x | Beta is actively changing; breaking changes possible before stable release | Drizzle ORM 0.45.x stable |
| Supabase Realtime subscriptions for sync | App is offline-first with manual sync; realtime subscriptions assume persistent connectivity and add complexity with no benefit | Manual push/pull via `supabase.from().upsert()` and `supabase.from().select()` RPC or REST calls on user-initiated sync |
| expo-camera for simple photo capture | Requires building a custom camera UI; overkill for "attach photo to tree" use case | expo-image-picker (handles both camera and gallery in one call, permission management included) |
| Expo Go for development | SDK 55 with expo-sqlite, expo-secure-store, and custom native modules requires a development build | `npx expo run:ios` or EAS Build dev profile |
| Global Supabase realtime client with `persistSession: true` without offline handling | When offline, Supabase client attempts token refresh and can log users out after network timeout | Set `autoRefreshToken: false` during offline operation, or use expo-secure-store to restore session manually on reconnect |

---

## Stack Patterns by Variant

**Sync architecture (manual, user-initiated):**
- Local SQLite is the source of truth at all times
- Supabase is write-only during sync (push SubGroup + Trees atomically via RPC or batch upsert)
- Pull updated data (other technicians' SubGroups, species catalog) after push succeeds
- Mark SubGroup as `synced = true` in local DB after successful push; make immutable
- Sync unit = one SubGroup + its Trees in a single Supabase transaction (Postgres function via RPC)
- Because `autoRefreshToken` can fail offline: persist session in expo-secure-store and restore on app foreground

**Photo storage (Phase 1 local-only):**
- Capture with expo-image-picker → copy to `FileSystem.documentDirectory` to ensure permanence
- Store local file URI in SQLite tree record
- expo-image-picker's default temp URI is NOT guaranteed to persist — always copy to document directory
- Phase 2 can add upload to Supabase Storage using `supabase.storage.from().upload()`

**Drizzle migration on startup:**
```typescript
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';

// In root layout:
const { success, error } = useMigrations(db, migrations);
```

**If offline at app launch:**
- SQLite initializes from local file — no network required
- Supabase client should NOT auto-refresh token on startup; restore session from expo-secure-store
- UI shows data from local DB immediately; sync button available when network detected

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| expo (SDK 55) | React Native 0.83, React 19.2 | New Architecture is default; legacy bridge removed |
| expo-sqlite (~15.x) | Expo SDK 55 | Use `npx expo install` to get correct version; do NOT pin manually |
| drizzle-orm (0.45.x) | expo-sqlite ~15.x | Use `driver: 'expo'` in drizzle.config.ts; Metro must support .sql extension |
| drizzle-kit (0.28.x) | drizzle-orm 0.45.x | Must match drizzle-orm minor version; check drizzle docs for pairing |
| @supabase/supabase-js (2.99.x) | React Native 0.83, Expo SDK 55 | Requires react-native-url-polyfill imported FIRST in entry file |
| expo-image-picker (~16.x) | Expo SDK 55 | Uses new permissions API; `useMediaLibraryPermissions()` and `useCameraPermissions()` hooks |
| expo-secure-store (~14.x) | Expo SDK 55 | 2048 byte value limit — store token, not entire session object; store JSON-serialized token parts separately if needed |

---

## Sources

- [Expo SQLite official docs](https://docs.expo.dev/versions/latest/sdk/sqlite/) — features, Drizzle integration, persistence behavior (HIGH confidence)
- [Local-first architecture with Expo](https://docs.expo.dev/guides/local-first/) — recommended solutions survey (HIGH confidence)
- [Modern SQLite for React Native apps — Expo Blog](https://expo.dev/blog/modern-sqlite-for-react-native-apps) — Drizzle + expo-sqlite recommendation rationale (HIGH confidence)
- [Drizzle ORM — Expo SQLite connect guide](https://orm.drizzle.team/docs/connect-expo-sqlite) — setup, version requirements, Metro config (HIGH confidence)
- [Expo SDK 55 changelog](https://expo.dev/changelog/sdk-55) — SDK 55 stable, React Native 0.83, package versioning scheme (HIGH confidence)
- [Supabase Expo React Native quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native) — required packages for Supabase in Expo (HIGH confidence)
- [@supabase/supabase-js npm — 2.99.1 latest](https://www.npmjs.com/package/@supabase/supabase-js) — version confirmed (HIGH confidence)
- [drizzle-orm npm — 0.45.1 stable](https://www.npmjs.com/package/drizzle-orm) — version confirmed (HIGH confidence)
- [Offline-first React Native Apps with Expo, WatermelonDB, and Supabase — Supabase Blog](https://supabase.com/blog/react-native-offline-first-watermelon-db) — alternative sync pattern analysis (MEDIUM confidence)
- [PowerSync: Bringing Offline-First To Supabase](https://www.powersync.com/blog/bringing-offline-first-to-supabase) — automated sync alternative evaluated and rejected for this project (MEDIUM confidence)
- [React Native Tech Stack 2025 — Galaxies.dev](https://galaxies.dev/article/react-native-tech-stack-2025) — community consensus on state management and navigation (MEDIUM confidence)
- [expo-secure-store official docs](https://docs.expo.dev/versions/latest/sdk/securestore/) — encrypted storage for auth tokens (HIGH confidence)
- [Supabase offline auth discussion](https://github.com/orgs/supabase/discussions/357) — offline session handling pitfall (MEDIUM confidence — community discussion, not official docs)

---

*Stack research for: Offline-first plantation monitoring mobile app (Bayka)*
*Researched: 2026-03-16*
