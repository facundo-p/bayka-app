---
name: build-apk
description: Build and generate an installable .apk for the Bayka app using EAS Build. Handles login check, build execution, and download link.
trigger: Use when the user wants to compile the app into an APK, generate a build, or install on a physical device.
---

# Build APK

Generate an installable .apk for the Bayka app via EAS Build.

## Process

### 1. Check EAS login status

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app-redesign/mobile
npx eas-cli whoami 2>&1
```

If not logged in, tell the user to run: `! npx eas-cli login`

### 2. Check EAS project is initialized

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app-redesign/mobile
grep -q "projectId" app.config.js && echo "OK" || echo "NEEDS_INIT"
```

If `EAS_PROJECT_ID` is empty in `.env`, tell the user to run `! npx eas-cli init` from the `mobile/` directory and add the resulting project ID to `.env` as `EAS_PROJECT_ID=<id>`.

### 3. Ask which build profile

Use AskUserQuestion:
- **Preview (Recommended)** — Standalone APK for field testing, no dev tools
- **Development** — APK with dev tools (hot reload, inspector) for development
- **Production** — Final production APK

### 4. Run the build

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app-redesign/mobile
npx eas-cli build --platform android --profile <selected_profile> --non-interactive 2>&1
```

This takes 5-15 minutes on the free tier. Run with `run_in_background` and notify when done.

### 5. Show result

When build completes:
- Extract the APK download URL from the output
- Show it to the user
- Offer to install directly if device is connected:
  ```bash
  npx eas-cli build:run -p android --latest
  ```

### 6. Summary

```
Build complete!

Profile: <profile>
APK URL: <url>

To install on a connected device:
  cd mobile && npx eas-cli build:run -p android --latest

Or download the APK from the URL above and transfer to your device.
```
