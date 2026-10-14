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

### 2. Check for native changes (contra el APK del canal, #678)

Este chequeo depende del canal (paso 3): si todavía no se sabe, preguntarlo acá. Se
compara el working tree contra el código **del APK que tienen instalado los devices de
ese canal**, no contra el último commit que tocó `package.json` (ese ya incluye el cambio
y el diff da vacío).

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-web-v1
git fetch origin --tags -q
(cd mobile && npm install)   # el script clasifica nativo/JS mirando mobile/node_modules
node .claude/skills/push-update-apk/scripts/nativos-vs-base.mjs <test|production>
```

Si `mobile/node_modules` no coincide con `mobile/package-lock.json`, el script lo avisa
arriba de todo (`AVISO: … correr npm install`): con una instalación vieja la
clasificación nativo/JS de esos paquetes no es confiable. Correr `npm install` y repetir.

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
**efectivos** agregados o quitados, y el diff de contenido de `app.json` y `app.config.js`
contra la base. Los plugins efectivos salen de evaluar `app.config.js` de cada lado con
la variante del canal (`APP_VARIANT=test` para `test`), así que cuentan los que suma
`app.config.js` (p. ej. `expo-font`) y los condicionales a la variante, no solo los de
`app.json`. La base se evalúa en un `git worktree` temporal con `node_modules` y los
`.env` linkeados del checkout; para `test` hace falta `mobile/.env.staging`. Sale con 1
si encontró algo nativo y con 2 si no pudo evaluar la config. Tests del script:
`node --test .claude/skills/push-update-apk/scripts/*.test.mjs`.

Lo que tiene que detectar, con el caso real de #677 (OTA a `test` contra `mobile-v1.3.0`):

```
Dependencias nativas distintas al APK:
  agregado @react-native-community/datetimepicker 8.4.4
```

Ese JS carga un módulo nativo que el APK 1.3.0 no tiene y la app crashea al abrir.

Si sale con 1 o 2, o el diff de `app.json`/`app.config.js` toca `plugins` (p. ej. solo
sus opciones), `android`, `updates` o `runtimeVersion`: **no publicar el OTA**. Mostrarle la lista al usuario y proponer un
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

Antes, confirmar que el fingerprint del working tree es el del APK de los devices. El
script resuelve el fingerprint con la variante del canal (`APP_VARIANT=test` para `test`,
sin variante para `production`, aunque la shell tenga otra exportada) y lo compara con
el de `mobile/build-output-test.apk` o `mobile/build-output.apk` según el canal:

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-web-v1
.claude/skills/push-update-apk/scripts/fingerprint-vs-apk.sh <test|production>
```

Si sale con 1, el OTA no le va a llegar a ese APK: parar y avisar (hace falta APK nuevo,
o se está publicando con la variante equivocada). Con 2 no pudo comparar (p. ej. no hay
APK local de ese canal). `npx expo-updates runtimeversion:resolve --platform android
--debug` lista las fuentes del hash (`fingerprintSources`); correrlo también en el commit
del APK y comparar muestra qué cambió.

Publicar con la misma variante, según el canal:

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-web-v1/mobile
# canal test
APP_VARIANT=test npx eas-cli update --channel test --message "<message>" --non-interactive 2>&1
# canal production (preview: igual, con --channel preview)
env -u APP_VARIANT npx eas-cli update --channel production --message "<message>" --non-interactive 2>&1
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
