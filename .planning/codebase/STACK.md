# Technology Stack

**Analysis Date:** 2026-04-12

## Languages

**Primary:**
- TypeScript 5.9.3 - Mobile and Supabase seed scripts
- JavaScript - React Native bundler configuration
- SQL (SQLite and Postgres) - Database schemas and migrations

**Secondary:**
- TSX (React Native) - Mobile UI components

## Runtime

**Environment:**
- Expo 54.0.0 - React Native development and deployment
- React Native 0.81.5 - Mobile framework
- React 19.1.0 - UI framework for React Native

**Package Manager:**
- npm (v8+)
- Lockfile: `package-lock.json` present (root level)

## Frameworks

**Core:**
- Expo Router 6.0.23 - File-based navigation for React Native
- React Native - Mobile UI rendering

**Data & ORM:**
- Drizzle ORM 0.45.1 - TypeScript-first SQLite ORM
- Drizzle Kit 0.31.9 - Schema generation and migrations

**Testing:**
- Jest 29.7.0 - Unit test runner
- Jest Expo 54.0.17 - Jest presets for Expo
- Testing Library React Native 12.9.0 - Component testing utilities

**Build/Dev:**
- EAS (Expo Application Services) - Cloud builds and deployment (configured via `eas.json`)
- TypeScript 5.9.2 - Type checking
- ESLint 9.0.0 - Code linting (via expo config)

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` (2.99.2) - Supabase client for auth and database
- `expo-sqlite` (16.0.10) - Local SQLite database for offline support
- `drizzle-orm` (0.45.1) - Type-safe database queries
- `react-native-reanimated` (4.1.1) - Performance-critical animations (required by gesture-handler)

**Storage & Files:**
- `expo-file-system` (19.0.21) - Local file system access for photo storage
- `expo-image-picker` (17.0.10) - Camera and gallery photo selection
- `expo-image-manipulator` (14.0.8) - Photo resizing and compression (1600px max dimension)
- `expo-secure-store` (15.0.8) - OS Keychain for session token persistence

**Authentication & Security:**
- `expo-crypto` (15.0.8) - SHA256 hashing for offline password verification
- `expo-secure-store` (15.0.8) - Stores Supabase tokens and offline credentials

**UI & Gesture Handling:**
- `react-native-gesture-handler` (2.28.0) - Gesture recognition primitives
- `react-native-safe-area-context` (5.6.0) - Safe area insets for notch handling
- `react-native-screens` (4.16.0) - Native screen components
- `react-native-draggable-flatlist` (4.0.3) - Draggable list reordering
- `@expo-google-fonts/poppins` (0.4.1) - Google Fonts integration

**Network & Offline:**
- `@react-native-community/netinfo` (11.4.1) - Network connectivity detection
- `react-native-url-polyfill` (3.0.0) - URL parsing for React Native

**Export & Data:**
- `xlsx` (0.18.5) - Excel export generation (SheetJS)
- `expo-sharing` (14.0.8) - Native share sheet for CSV/Excel export

**State & Async:**
- `@react-native-async-storage/async-storage` (2.2.0) - Persistent JSON storage for cache
- `expo-updates` (29.0.16) - OTA update support via EAS
- `scheduler` (0.27.0) - React scheduler polyfill

**Other:**
- `expo-linking` (8.0.11) - Deep link handling
- `expo-constants` (18.0.13) - Build-time constants and configuration
- `expo-asset` (12.0.12) - Asset bundling
- `expo-font` (14.0.11) - Font loading
- `expo-splash-screen` (31.0.13) - Splash screen control
- `expo-status-bar` (3.0.9) - Status bar styling
- `dotenv` (17.3.1) - Environment variable loading (development only)
- `react-native-worklets` (0.5.1) - Worklet support for animations

## Configuration

**Environment:**
- Root `.env` file (git-ignored, example at `.env.example`)
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (public, safe in code)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (root level only, never committed)
- `EAS_PROJECT_ID` - Expo Application Services project identifier

**Build:**
- `mobile/app.config.js` - Expo/EAS configuration with plugin setup
- `mobile/tsconfig.json` - TypeScript configuration (extends `expo/tsconfig.base`)
- `mobile/drizzle.config.ts` - Drizzle ORM config (SQLite/Expo driver)
- `mobile/eslint.config.js` - Flat ESLint config (expo-config base)
- `mobile/jest.config.js` - Jest test runner configuration

**Package Management:**
- Root `package.json` - Shared tooling (TypeScript, tsx, dotenv, Supabase)
- `mobile/package.json` - App dependencies

## Database

**Local:**
- SQLite via `expo-sqlite` (file: `bayka.db`)
- Managed via Drizzle ORM with migrations in `mobile/drizzle/`
- 9 migrations (0000-0008) covering schema, species catalog, sync flags, photo tracking

**Remote:**
- Supabase (PostgreSQL backend)
- Seed script at `supabase/seed.ts` (admin-only)
- 8 SQL migration files in `supabase/migrations/` (schema, RLS, storage policies, species data)

## Platform Requirements

**Development:**
- Node.js 18+ (npm 9+)
- Expo CLI or EAS CLI for local testing
- iOS Xcode or Android SDK (for native builds)

**Production:**
- EAS cloud builds (via `eas.json`, configured for local builds only)
- iOS 13+ / Android 5+
- Network connection required for sync (offline mode with local SQLite)

## Deployment

**Binary Distribution:**
- EAS (Expo Application Services) for managed builds
- `eas.json` configured but empty (projects use local `eas build --local`)
- OTA updates via `expo-updates` (EAS Update required)

**Secrets Management:**
- `.env` file (git-ignored)
- Supabase environment variables in `app.config.js`
- Service role key only in root `.env`, never in mobile/

---

*Stack analysis: 2026-04-12*
