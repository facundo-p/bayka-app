---
status: testing
phase: 01-foundation-auth
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md]
started: 2026-03-17T12:00:00Z
updated: 2026-03-17T12:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running Expo dev server. Clear app data / delete the app. Run `npx expo start` from mobile/ directory. App boots without errors, shows "Inicializando..." briefly, then shows the login screen. No crash, no red error screen. Check the terminal — no migration errors.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running Expo dev server. Clear app data / delete the app. Run `npx expo start` from mobile/ directory. App boots without errors, shows "Inicializando..." briefly, then shows the login screen. No crash, no red error screen. Check the terminal — no migration errors.
result: [pending]

### 2. Supabase Setup Verification
expected: In the Supabase Dashboard: (1) SQL Editor — paste and run `supabase/migrations/001_initial_schema.sql`, verify 8 tables appear in Table Editor. (2) Fill `.env` with real credentials. (3) Run `npx tsx supabase/seed.ts` from repo root. (4) Check Authentication → Users: 4 users (admin1@bayka.org, admin2@bayka.org, tecnico1@bayka.org, tecnico2@bayka.org). (5) Check Table Editor → profiles: 4 rows with correct roles. (6) Check Table Editor → organizations: 1 row named "Bayka".
result: [pending]

### 3. Login with Valid Admin Credentials
expected: On the login screen, enter admin1@bayka.org with the password set in the seed script. Tap "Iniciar sesión". App navigates to the admin tab layout with 3 bottom tabs: "Plantaciones", "Admin", "Perfil".
result: [pending]

### 4. Login Error — Wrong Credentials
expected: On the login screen, enter a wrong password. Tap "Iniciar sesión". A red inline error appears below the form saying "Email o contraseña incorrectos". No crash, no alert dialog.
result: [pending]

### 5. Email Pre-fill After Successful Login
expected: After logging in successfully once and logging out, return to the login screen. The email field should be pre-filled with the last used email address.
result: [pending]

### 6. Admin Navigation — 3 Tabs
expected: After logging in as admin1@bayka.org, the bottom tab bar shows exactly 3 tabs: "Plantaciones", "Admin", and "Perfil". Each tab navigates to its screen without errors.
result: [pending]

### 7. Tecnico Navigation — 2 Tabs
expected: Log out, then log in as tecnico1@bayka.org. The bottom tab bar shows exactly 2 tabs: "Plantaciones" and "Perfil". No "Admin" tab visible. Each tab navigates to its screen.
result: [pending]

### 8. Logout
expected: On the "Perfil" tab (either role), tap "Cerrar sesión". App navigates back to the login screen. The session is cleared — reopening the app shows the login screen, not the dashboard.
result: [pending]

### 9. Offline Session Persistence
expected: Log in with any user while connected to the internet. Then enable airplane mode (or turn off Wi-Fi/data). Force close the app completely. Reopen the app. It should go directly to the correct tab layout (admin or tecnico) without showing the login screen — session was restored from local storage.
result: [pending]

### 10. Multi-User Same Device
expected: Log in as admin1@bayka.org — see 3 tabs. Log out. Log in as tecnico1@bayka.org — see 2 tabs. Each user gets their own session and correct navigation. No leftover data from previous user.
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0

## Gaps

[none yet]
