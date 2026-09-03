---
name: push-update-apk
description: Push an OTA update to all devices with the Bayka app installed, without requiring APK reinstall. Uses EAS Update.
trigger: Use when the user wants to update the app on all installed devices, push changes OTA, or deploy JS/UI changes without rebuilding.
---

# Push OTA Update

Push code changes to all devices that have the Bayka app installed, without requiring a new APK install.

**Important:** OTA updates only work for JS/TS/asset changes. If native modules or config
plugins changed, use the `build-apk-local` skill instead (no existe ningun `/build-apk`).

**Regla de release (CLAUDE.md, #273):** el OTA es SOLO para hotfixes dentro de una version
ya publicada. Un release con cambios mobile ⇒ **APK nuevo** con `expo.android.versionCode`
+1 en `mobile/app.json` (lo bumpea el skill `deploy`), NO un OTA. Si lo que te piden empujar
es un release, parar y usar `deploy`.

## Process

### 1. Check EAS login

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-web-v1/mobile
npx eas-cli whoami 2>&1
```

If not logged in, tell the user to run: `! npx eas-cli login`

### 2. Check for native changes

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-web-v1/mobile
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
- **Preview (Recommended)** — Update preview builds (variante prod instalada desde el profile `preview`)
- **Test** — Update builds de la variante **Bayka TEST** (staging; EAS profile/channel `test`, #253)
  > ⚠️ Antes de un update al canal `test`, exportar `APP_VARIANT=test` en la shell:
  > `app.config.js` hornea `extra` (URL/anon key de Supabase **y** `appVariant`, #287)
  > con el env del momento. Sin la variable, el update sale apuntando a prod y sin
  > el banner "ENTORNO DE PRUEBAS".
- **Production** — Update production builds

### 4. Ask for update message

Use AskUserQuestion:
- Ask: "Describe what changed in this update (shown in EAS dashboard)"

### 5. Push the update

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-web-v1/mobile
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
