---
name: build-apk-local
description: Build an APK locally using EAS Build --local. Faster than remote builds (3-8 min vs queue wait). Requires Android SDK and Java 17.
trigger: Use when the user wants to build an APK locally, avoid EAS queue wait times, or do a quick local build.
---

# Build APK Local

Generate an installable .apk locally using EAS Build with `--local` flag. No queue wait.

## Process

### 1. Verify local build prerequisites

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app-redesign/mobile
echo "ANDROID_HOME: ${ANDROID_HOME:-NOT SET}"
java -version 2>&1 | head -1
```

Both are required:
- `ANDROID_HOME` must point to Android SDK (expected: `/Users/facu/Library/Android/sdk`)
- Java 17 must be installed

If `ANDROID_HOME` is not set, tell the user to add it to their shell profile:
```
export ANDROID_HOME=$HOME/Library/Android/sdk
```

If Java is missing, tell the user: `brew install openjdk@17`

### 2. Check EAS login status

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app-redesign/mobile
npx eas-cli whoami 2>&1
```

If not logged in, tell the user to run: `! npx eas-cli login`

### 3. Ask which build profile

Use AskUserQuestion:
- **Preview (Recommended)** — Standalone APK for field testing, no dev tools
- **Development** — APK with dev tools (hot reload, inspector)
- **Production** — Final production APK

### 4. Run the local build

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app-redesign/mobile
npx eas-cli build --platform android --profile <selected_profile> --local --non-interactive --output ./build-output.apk 2>&1
```

Run with `run_in_background` and timeout of 600000ms (10 min). Local builds typically take 3-8 minutes.

### 5. Show result

When build completes:
- Check the output APK exists:
  ```bash
  ls -lh /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app-redesign/mobile/build-output.apk
  ```
- Show file size and path
- Offer to install on connected device:
  ```bash
  cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app-redesign/mobile
  adb install build-output.apk
  ```

### 6. Summary

```
Build local complete!

Profile: <profile>
APK: mobile/build-output.apk
Size: <size>

To install on a connected device:
  cd mobile && adb install build-output.apk

Or transfer the APK file to your device manually.
```
