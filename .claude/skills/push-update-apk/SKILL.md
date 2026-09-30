---
name: push-update-apk
description: Push an OTA update to all devices with the Bayka app installed, without requiring APK reinstall. Uses EAS Update.
trigger: Use when the user wants to update the app on all installed devices, push changes OTA, or deploy JS/UI changes without rebuilding.
---

# Push OTA Update

Push code changes to all devices that have the Bayka app installed, without requiring a new APK install.

**Important:** OTA updates only work for JS/TS/asset changes. If native modules or config
plugins changed, use the `build-apk-local` skill instead (no existe ningun `/build-apk`).

**El canal se graba en el build, no en el update.** Un update solo llega a los devices
cuyo APK tiene grabado ese canal. Los APK locales lo toman de `updates.requestHeaders`
en `app.config.js` (#384): un APK compilado antes de ese fix no recibe nada, en silencio.
EAS Update empareja ademas por `runtimeVersion`, que es el **fingerprint** del nativo
(#678): un hash de dependencias nativas, config plugins y config de Expo (incluidos
`version`/`versionCode`, nombre, package e íconos de la variante; sin `extra` ni los
`scripts`, ver `mobile/fingerprint.config.js`). El OTA solo llega a los APK con el mismo
fingerprint: si el JS necesita un módulo nativo que el APK no tiene, el hash difiere y
el update no se entrega, en vez de crashear la app. Consecuencias:

- Prod y TEST tienen fingerprints distintos. Un update al canal `test` publicado sin
  `APP_VARIANT=test` sale con el fingerprint de prod y no le llega a ningún APK TEST.
- Un bump de versión (release) cambia el fingerprint: los APK viejos quedan afuera hasta
  instalar el nuevo, igual que antes con `appVersion`.
- Los APK compilados con `appVersion` (hasta mobile 1.3.0 inclusive) tienen runtime
  `"1.3.0"` y ya no reciben ningún OTA: hay que instalarles un APK nuevo una vez.
- Con `node_modules` symlinkeado (worktrees) el fingerprint sale distinto: publicar y
  compilar solo desde un checkout con `node_modules` propio, como el principal.
- Los APK de EAS en la nube omiten `updates.requestHeaders` (`EAS_BUILD=true`) y por eso
  tienen otro fingerprint que el de un `eas update` local: no reciben estos OTA.

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
you need the build-apk-local skill first. OTA updates only cover JS/TS/asset changes.

Continue anyway?
```

### 3. Ask for update channel

El canal tiene que existir en EAS antes de un update `--non-interactive`:

```bash
npx eas-cli channel:list 2>&1            # crear el que falte: channel:create <canal>
```

Use AskUserQuestion:
- **Test (Recommended)** — Update builds de la variante **Bayka TEST** (staging; canal `test`, #253)
  > ⚠️ Antes de un update al canal `test`, exportar `APP_VARIANT=test` en la shell:
  > `app.config.js` hornea `extra` (URL/anon key de Supabase **y** `appVariant`, #287)
  > con el env del momento. Sin la variable, el update sale apuntando a prod y sin
  > el banner "ENTORNO DE PRUEBAS". El commit que muestra el banner sale del
  > working tree al correr el update (#321): tras el OTA los devices muestran
  > el commit del código nuevo, no el del APK instalado — sirve para confirmar
  > que el update llegó.
- **Production** — Update de la app de produccion (canal `production`)
- **Preview** — Canal `preview`, solo para builds hechos con `eas build --profile preview`.
  Los APK locales nunca estan en este canal.

### 4. Ask for update message

Use AskUserQuestion:
- Ask: "Describe what changed in this update (shown in EAS dashboard)"

### 5. Push the update

Antes, confirmar que el fingerprint del working tree es el del APK de los devices (con
`APP_VARIANT=test` exportado para el canal `test`; el APK es `build-output-test.apk` o
`build-output.apk` según el canal):

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-web-v1/mobile
npx expo-updates runtimeversion:resolve --platform android 2>/dev/null | tail -1 | jq -r .runtimeVersion
unzip -p build-output-test.apk assets/fingerprint; echo
```

Si difieren, el OTA no le va a llegar a ese APK: parar y avisar (hace falta APK nuevo, o
se está publicando con la variante equivocada). `runtimeversion:resolve --debug` lista
las fuentes del hash (`fingerprintSources`); correrlo también en el commit del APK y
comparar muestra qué cambió.

```bash
npx eas-cli update --channel <channel> --message "<message>" --non-interactive 2>&1
```

### 6. Show result

```
OTA Update pushed!

Channel: <channel>
Message: <message>

Los devices de ese canal con el mismo fingerprint nativo lo bajan en segundo
plano al abrir la app. Una vez descargado aparece un aviso arriba de todo con un
boton para reiniciar y aplicarlo en el momento (bloqueado mientras haya una sync
en curso); si el usuario no lo usa, se aplica en el siguiente arranque en frio.
Sin reinstalar nada.

En la app TEST se confirma en la franja roja, que pasa a mostrar el commit del
codigo recien publicado (#321).

Dashboard: https://expo.dev (check updates section)
```
