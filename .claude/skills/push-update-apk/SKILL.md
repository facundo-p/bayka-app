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
EAS Update empareja ademas por `runtimeVersion` — con la politica `appVersion` es
`expo.version` de `app.json`, asi que un device con otra version de mobile queda afuera.

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

### 2. Check for native changes (contra el APK del canal, #678)

Este chequeo depende del canal (paso 3): si todavía no se sabe, preguntarlo acá. Se
compara el working tree contra el código **del APK que tienen instalado los devices de
ese canal**, no contra el último commit que tocó `package.json` (ese ya incluye el cambio
y el diff da vacío).

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-web-v1
git fetch origin --tags -q
node .claude/skills/push-update-apk/scripts/nativos-vs-base.mjs <test|production>
```

Base que toma el script, por canal:

- **`production`**: el último tag `mobile-v*` alcanzable desde `origin/main`; el APK de
  prod se compila de ese release.
- **`test`**: el commit del último APK TEST compilado en esta máquina, que lee de
  `extra.commit` dentro de `mobile/build-output-test.apk` (sin el `-dirty`). Sin ese
  archivo cae al mismo tag que prod. Si los devices tienen otro APK TEST, pasarlo con
  `--base <commit>`.

Lista las dependencias **nativas** de `mobile/package.json` agregadas, quitadas o con otra
versión (nativa = el paquete trae `android/`, `expo-module.config.json`,
`react-native.config.js` o `app.plugin.js`; las JS puras no aparecen), los config plugins
de `app.json` agregados o quitados, y el diff de `package.json`/`app.json`/`app.config.js`
contra la base. Sale con 1 si encontró algo nativo. Tests del script:
`node --test .claude/skills/push-update-apk/scripts/nativos.test.mjs`.

Lo que tiene que detectar, con el caso real de #677 (OTA a `test` contra `mobile-v1.3.0`):

```
Dependencias nativas distintas al APK:
  agregado @react-native-community/datetimepicker 8.4.4
```

Ese JS carga un módulo nativo que el APK 1.3.0 no tiene y la app crashea al abrir.

Si sale con 1, o el diff de `app.json`/`app.config.js` toca `plugins`, `android`, `updates`
o `runtimeVersion`: **no publicar el OTA**. Mostrarle la lista al usuario y proponer un
APK nuevo (`build-apk-local`). Seguir solo si lo confirma explícitamente.

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

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-web-v1/mobile
npx eas-cli update --channel <channel> --message "<message>" --non-interactive 2>&1
```

### 6. Show result

```
OTA Update pushed!

Channel: <channel>
Message: <message>

Los devices de ese canal con la misma version de mobile lo bajan en segundo
plano al abrir la app. Una vez descargado aparece un aviso arriba de todo con un
boton para reiniciar y aplicarlo en el momento (bloqueado mientras haya una sync
en curso); si el usuario no lo usa, se aplica en el siguiente arranque en frio.
Sin reinstalar nada.

En la app TEST se confirma en la franja roja, que pasa a mostrar el commit del
codigo recien publicado (#321).

Dashboard: https://expo.dev (check updates section)
```
