---
name: push-update-apk
description: Push an OTA update to all devices with the Bayka app installed, without requiring APK reinstall. Uses EAS Update.
trigger: Use when the user wants to update the app on all installed devices, push changes OTA, or deploy JS/UI changes without rebuilding.
---

# Push OTA Update

Push code changes to all devices that have the Bayka app installed, without requiring a new APK install.

**Important:** OTA updates only work for JS/TS/asset changes. If native modules or config plugins changed, the user needs `/build-apk` instead.

## Process

### 1. Check EAS login

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app-redesign/mobile
npx eas-cli whoami 2>&1
```

If not logged in, tell the user to run: `! npx eas-cli login`

### 2. Check for native changes

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app-redesign/mobile
git diff --name-only HEAD $(git log --oneline -1 --format=%H -- eas.json app.json app.config.js package.json 2>/dev/null || echo HEAD~1) -- app.json app.config.js package.json eas.json 2>/dev/null
```

If `package.json` changed (new native dependencies), warn:
```
New native dependencies detected. If you added a native module,
you need /build-apk first. OTA updates only cover JS/TS/asset changes.

Continue anyway?
```

### 3. Ask for update channel

Use AskUserQuestion:
- **Preview (Recommended)** — Update preview/testing builds
- **Production** — Update production builds

### 4. Ask for update message

Use AskUserQuestion:
- Ask: "Describe what changed in this update (shown in EAS dashboard)"

### 5. Push the update

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app-redesign/mobile
npx eas-cli update --channel <channel> --message "<message>" --non-interactive 2>&1
```

### 6. Show result

```
OTA Update pushed!

Channel: <channel>
Message: <message>

All devices running the app will receive this update
on their next app launch. No reinstall needed.

Dashboard: https://expo.dev (check updates section)
```
