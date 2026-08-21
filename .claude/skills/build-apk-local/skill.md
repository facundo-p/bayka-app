---
name: build-apk-local
description: Build an installable Android APK locally for Bayka, for either variant — prod ("Bayka App" → Supabase prod) or test ("Bayka TEST" → Supabase staging, TEST icon, installable alongside prod). Delegates to mobile/scripts/build-apk.sh (persistent expo prebuild + gradlew single-ABI). Requires Android SDK, Java 17, Node LTS (NOT v25). Use when the user wants a local APK (de prod o de staging/test), to avoid EAS queue, or to test a change on a device.
trigger: Use when the user wants to build an APK locally (prod or TEST/staging variant), avoid EAS queue wait times, or do a quick local build.
---

# Build APK Local (Bayka) — variantes prod y test

Project root: `/Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-web-v1`
Mobile dir:   `/Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-web-v1/mobile`

Todo el flujo vive en **`mobile/scripts/build-apk.sh <prod|test>`** (#253). El script
verifica prerequisitos, regenera el prebuild, compila con retry y valida que el APK
resultante sea de la variante pedida. Este skill documenta cómo invocarlo y cómo
diagnosticar fallas.

## Variantes

| | `prod` | `test` |
|---|---|---|
| Nombre / ícono | "Bayka App", ícono normal | "Bayka TEST", franja roja TEST |
| applicationId | `com.bayka.app` | `com.bayka.app.test` (conviven en un device) |
| Supabase | prod (según `mobile/.env`) | **staging** (según `mobile/.env.staging`) |
| Artefacto | `mobile/build-output.apk` | `mobile/build-output-test.apk` |

La variante se decide con `APP_VARIANT=test` en `app.config.js`; el script la exporta
en prebuild Y gradlew. `mobile/.env.staging` está gitignoreado — si falta, las
credenciales de staging están en el Bitwarden del cliente (checklist #244).

## 1. Prerequisitos — verificar ANTES de compilar

```bash
echo "ANDROID_HOME: ${ANDROID_HOME:-NOT SET}"   # expect /Users/facu/Library/Android/sdk
java -version 2>&1 | head -1                      # expect openjdk 17.x
node --version                                    # MUST be LTS (v20/v22). NOT v25.
```

El script los re-chequea y falla con mensaje claro, pero conviene validarlos primero:
- **ANDROID_HOME** missing → `export ANDROID_HOME=$HOME/Library/Android/sdk` en el shell profile.
- **Java** missing → `brew install openjdk@17`.
- **Node no-LTS (v25, o cualquier major impar)** → STOP: rompe el build (y el node de
  Homebrew puede estar linkeado contra un libsimdjson inexistente y crashear):
  ```bash
  brew install node@22 2>/dev/null
  brew unlink node 2>/dev/null; brew link --overwrite node@22
  node --version   # debe imprimir v22.x
  ```

## 2. Build

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-web-v1/mobile
scripts/build-apk.sh test    # o: prod   (equivalentes: npm run apk:test / apk:prod)
```

Correr con `run_in_background: true` y timeout 600000ms. Single-ABI arm64-v8a tarda
~2-5 min (más la primera vez, con el cache de Gradle frío). Para todas las ABIs
(distribución): `ABIS=all scripts/build-apk.sh <variante>` — el retry interno de
gradlew cubre la race de worklets (ver Troubleshooting).

El script termina imprimiendo package, label y tamaño **ya verificados** (falla si el
APK no corresponde a la variante). Instalar: `adb install -r mobile/<artefacto>`.

## 3. Notas y gotchas

- **Prebuild por variante:** `android/` (gitignoreado) se regenera con `--clean` en
  cada build. NO compilar con gradlew a mano después de cambiar de variante sin
  re-prebuild: quedaría la config de la variante anterior.
- **Signing:** firma con el **debug keystore** (default del template de Expo), NO la
  release key de EAS. Instalable para testing; si en el device hay un build con OTRA
  firma del MISMO applicationId, Android rechaza instalar encima —
  `adb uninstall com.bayka.app` (o `com.bayka.app.test`) primero (borra data local).
- **Deep links:** ambas variantes registran el scheme `bayka`; con las dos instaladas
  Android pregunta con cuál abrir. Esperado y aceptado (#253).
- **ABIs:** el APK single-ABI solo corre en devices arm64 (todo teléfono moderno).
  `ABIS=all` solo para armeabi-v7a viejos o emuladores x86_64.

## Troubleshooting

### `ninja: error: '.../libworklets.so' ... missing and no known rule to make it`
El CMake de reanimated linkea el `.so` de worklets desde un path que no está listo
cuando corre el link arm64 de reanimated. Lo dispara compilar **varias ABIs en una
pasada efímera** (EAS `--local`). Mitigado en el script: single-ABI por default +
build-twice (pasa 2 encuentra el `.so` persistido). No lo causan: caches,
`org.gradle.parallel`, NDK, node_modules ni versiones de Expo/reanimated — el
**método** de build es lo que importa.

### `dyld: Library not loaded: .../libsimdjson.*.dylib ... Referenced from: .../node`
Node de Homebrew roto (usualmente v25). Fix en Prerequisitos: `node@22` LTS.

### El APK sale con package/label de la otra variante
No usaste el script (o gradlew corrió sin `APP_VARIANT` exportado). Compilar SIEMPRE
vía `scripts/build-apk.sh <variante>` — regenera el prebuild y valida el badging.

### EAS como alternativa (nube o `--local`)
Perfiles en `mobile/eas.json`: `preview`/`production` (prod) y `test` (staging, con
`APP_VARIANT=test`). `npx eas-cli build -p android --profile test` da un APK firmado
con la release key y multi-ABI — mejor para distribución. El modo `--local` sufre la
race de worklets (single ephemeral multi-ABI pass); preferir el script de arriba.
