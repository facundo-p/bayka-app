---
status: fixing
trigger: "Project is incompatible with this version of Expo Go — requires newer version"
created: 2026-03-28T00:00:00Z
updated: 2026-03-28T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — Root workspace package.json has expo 55 canary (55.0.10-canary-20260328-bdc6273), which is installed in root node_modules. When user runs `npx expo start` or `npm start` from the ROOT directory, npx resolves the canary expo binary instead of the intended SDK 54 in mobile/node_modules.
test: Verified by running `npx --no-install expo --version` from root (returns 55 canary) vs from mobile/ (returns 54.0.23)
expecting: Fix is to remove expo from root package.json and root node_modules, or always run from mobile/
next_action: Present findings and fix recommendation to user

## Symptoms

expected: App loads and runs in Expo Go on Android device
actual: Error "Project is incompatible with this version of Expo Go" — app won't launch
errors: "ERROR  Project is incompatible with this version of Expo Go. This project requires a newer version of Expo Go."
reproduction: Run the Expo project and open it in Expo Go on device
started: Current state — unclear when it started

## Eliminated

- hypothesis: expo-* package version mismatches within mobile/
  evidence: All expo-* packages in mobile/package.json are consistent with expo 54 (expo-router 6.x, expo-constants 18.x, etc.)
  timestamp: 2026-03-28

- hypothesis: RN version mismatch (0.81.5 incompatible with SDK 54)
  evidence: expo 54's bundledNativeModules.json explicitly lists react-native 0.81.5 — they are compatible
  timestamp: 2026-03-28

- hypothesis: Expo Go app on device is too old for SDK 54
  evidence: The canary version 55 is what gets served when running from root — that is what Expo Go rejects, not SDK 54
  timestamp: 2026-03-28

## Evidence

- timestamp: 2026-03-28
  checked: root package.json dependencies
  found: "expo": "^55.0.10-canary-20260328-bdc6273" in root package.json dependencies
  implication: Root workspace declares a canary (pre-release) Expo SDK 55

- timestamp: 2026-03-28
  checked: mobile/package.json dependencies
  found: "expo": "^54.0.0" — installed as 54.0.33
  implication: Mobile app is intentionally on SDK 54

- timestamp: 2026-03-28
  checked: npx expo --version from root vs mobile/
  found: Root resolves to 55.0.20-canary-20260328-bdc6273; mobile/ resolves to 54.0.23
  implication: Running `npx expo start` or `npm start` from the wrong directory (root) starts the app with SDK 55 canary, which Expo Go does not support

- timestamp: 2026-03-28
  checked: expo 54 bundledNativeModules.json
  found: react-native listed as 0.81.5
  implication: expo 54 + RN 0.81.5 is intentional and consistent — no mismatch there

## Resolution

root_cause: The root workspace package.json incorrectly includes "expo": "^55.0.10-canary-20260328-bdc6273" as a dependency. This installs a pre-release canary expo binary in root/node_modules/. When the project is started with `npx expo start` from the root directory (or if npx resolves the root binary), it runs SDK 55 canary instead of the mobile app's SDK 54. Expo Go on the device does not support this canary version, producing the incompatibility error.
fix: Remove expo from root package.json dependencies. The root workspace is only for seed scripts and has no need for expo. Alternatively, always run `npm start` from inside the mobile/ directory.
verification:
files_changed: [package.json, package-lock.json]
