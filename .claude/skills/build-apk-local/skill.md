---
name: build-apk-local
description: Build an installable Android APK locally for Bayka. Uses persistent expo prebuild + gradlew (single-ABI), which is reliable. Requires Android SDK, Java 17, and Node LTS (NOT v25). Use when the user wants a local APK, to avoid EAS queue, or to test a change on a device.
trigger: Use when the user wants to build an APK locally, avoid EAS queue wait times, or do a quick local build.
---

# Build APK Local (Bayka)

Project root: `/Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app`
Mobile dir:   `/Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app/mobile`

> **History:** The old EAS `--local` path (all 4 ABIs in one ephemeral build) started
> failing in June 2026 with a `react-native-reanimated` ↔ `react-native-worklets`
> native link error. Root cause was twofold (see Troubleshooting). The reliable
> method below builds in a **persistent `android/` dir, single-ABI**, which sidesteps it.

## 0. Prerequisites — verify ALL THREE before building

```bash
echo "ANDROID_HOME: ${ANDROID_HOME:-NOT SET}"   # expect /Users/facu/Library/Android/sdk
java -version 2>&1 | head -1                      # expect openjdk 17.x
node --version                                    # MUST be an LTS (v20 or v22). NOT v25.
```

- **ANDROID_HOME** missing → tell user to add `export ANDROID_HOME=$HOME/Library/Android/sdk` to their shell profile.
- **Java** missing → `brew install openjdk@17`.
- **Node is v25 (or any non-LTS / odd major)** → STOP. This breaks the build (and Homebrew
  may have left it linked against a missing `libsimdjson` dylib, so it crashes outright).
  Fix:
  ```bash
  brew install node@22 2>/dev/null
  brew unlink node 2>/dev/null; brew link --overwrite node@22
  node --version   # must now print v22.x
  ```
  Expo SDK 54 / RN 0.81 support Node 20 or 22 LTS only.

## 1. Generate the native project (expo prebuild)

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app/mobile
npx expo prebuild -p android --clean
```

This regenerates `mobile/android/` (a generated dir; it will show as git changes — that's expected).

## 2. Build the APK (single-ABI, with a built-in retry)

The build needs the Supabase public env vars (mirrors `eas.json` → build.preview.env).
Single ABI `arm64-v8a` is what modern phones use and avoids the multi-ABI native-build race.

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app/mobile/android
export EXPO_PUBLIC_SUPABASE_URL="https://apktttwrmhamfudjeklu.supabase.co"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="<copy from mobile/eas.json → build.preview.env>"

# Pass 1 (usually succeeds). If it ever fails on the reanimated/worklets link,
# Pass 2 finds the now-persisted libworklets.so and completes — that's the safety net.
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon \
  || ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon
```

Run with `run_in_background: true` and a 600000ms timeout. Single-ABI build is ~2-3 min
(longer the first time if the Gradle cache is cold). To build all ABIs (for distribution),
drop the `-PreactNativeArchitectures` flag, but ALWAYS keep the `|| <retry>` build-twice.

## 3. Locate, copy, and verify the APK

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app/mobile
cp android/app/build/outputs/apk/release/app-release.apk build-output.apk
ls -lh build-output.apk
# Optional: confirm signing (will be the Android DEBUG keystore — see note)
"$(ls $ANDROID_HOME/build-tools/*/apksigner | sort -V | tail -1)" verify --print-certs build-output.apk 2>&1 | grep -i "certificate DN"
```

## 4. Result summary

```
APK local listo!
  APK:  mobile/build-output.apk
  Size: <size>  (arm64-v8a only)
  Firma: Android Debug keystore

Instalar en dispositivo conectado:
  cd mobile && adb install -r build-output.apk
```

## Notes & gotchas

- **Signing:** `gradlew assembleRelease` signs with the **debug keystore** (the Expo template
  default), NOT the EAS-managed release key. The APK is installable for testing, but if a
  build signed with a DIFFERENT key is already on the device, Android refuses to install over
  it — `adb uninstall com.bayka.app` first (this wipes local app data).
- **ABIs:** the single-ABI APK only runs on arm64 devices (all modern phones). Add ABIs only
  if you need armeabi-v7a (old devices) or emulators (x86_64).
- **build-output.apk** is the canonical artifact location the team expects.

## Troubleshooting

### `ninja: error: '.../libworklets.so' ... missing and no known rule to make it`
reanimated's CMake links worklets' `.so` from a path that isn't ready when reanimated's
arm64 link runs. Triggered by building **multiple ABIs in one ephemeral pass** (EAS `--local`)
where task scheduling loses the worklets→reanimated ordering. Fixes:
1. Build a **single ABI** (`-PreactNativeArchitectures=arm64-v8a`), and/or
2. **Build twice** in a persistent `android/` (pass 2 finds the persisted `.so`).
Not caused by: caches, `org.gradle.parallel`, NDK, node_modules, or the Expo/reanimated
versions — reproducing the last-good versions does NOT fix it; the build *method* is what matters.

### `dyld: Library not loaded: .../libsimdjson.*.dylib ... Referenced from: .../node`
Your Homebrew `node` is broken (linked against a simdjson version that was upgraded away).
This is usually Node v25. Fix per Prerequisites: switch to `node@22` LTS.

### EAS `--local` as an alternative
EAS `--local` (`npx eas-cli build -p android --profile preview --local --output ./build-output.apk`)
gives a release-keystore-signed, multi-ABI APK — better for distribution — but currently hits
the worklets race because it's a single ephemeral multi-ABI pass. If you must use it, first
pin the project to a single ABI, or expect to fall back to the gradlew method above.
```
