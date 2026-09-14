#!/usr/bin/env bash
# Build local del APK de Bayka, por variante (#253).
#
# Uso (desde mobile/):
#   scripts/build-apk.sh prod   → Bayka App  (com.bayka.app)      → build-output.apk
#   scripts/build-apk.sh test   → Bayka TEST (com.bayka.app.test) → build-output-test.apk
#
# Estrategia anti-contaminación: android/ (gitignoreado) se regenera con
# `expo prebuild --clean` en CADA build, así el directorio nativo siempre
# corresponde a la variante pedida. APP_VARIANT se exporta para el prebuild
# Y para gradlew (el bundle JS re-evalúa app.config.js durante el build).
#
# Env opcional: ABIS=all → todas las ABIs (default: solo arm64-v8a, ver skill
# build-apk-local para el porqué del single-ABI y del retry de gradlew).
set -euo pipefail

MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$MOBILE_DIR"

VARIANT="${1:-}"
case "$VARIANT" in
  prod)
    export APP_VARIANT=""
    EXPECTED_PKG="com.bayka.app"
    EXPECTED_LABEL="Bayka App"
    EXPECTED_CANAL="production"
    ARTIFACT="build-output.apk"
    ;;
  test)
    export APP_VARIANT="test"
    EXPECTED_PKG="com.bayka.app.test"
    EXPECTED_LABEL="Bayka TEST"
    EXPECTED_CANAL="test"
    ARTIFACT="build-output-test.apk"
    ;;
  *)
    echo "Uso: $0 <prod|test>" >&2
    exit 2
    ;;
esac

# --- Prerequisitos (ver skill build-apk-local) --------------------------------
[ -n "${ANDROID_HOME:-}" ] || { echo "ERROR: ANDROID_HOME no seteado (export ANDROID_HOME=\$HOME/Library/Android/sdk)" >&2; exit 1; }
java -version 2>&1 | head -1 | grep -qE 'version "17\.' || { echo "ERROR: se necesita Java 17 (brew install openjdk@17)" >&2; exit 1; }
NODE_MAJOR="$(node --version | sed 's/^v//' | cut -d. -f1)"
if [ $((NODE_MAJOR % 2)) -ne 0 ] || [ "$NODE_MAJOR" -lt 20 ]; then
  echo "ERROR: Node $(node --version) no es LTS par >= 20 (brew link --overwrite node@22)" >&2
  exit 1
fi
if [ "$VARIANT" = "test" ]; then
  [ -f .env.staging ] || { echo "ERROR: falta mobile/.env.staging (env de Supabase staging; está en Bitwarden)" >&2; exit 1; }
  grep -q "PEGAR_" .env.staging && { echo "ERROR: mobile/.env.staging tiene placeholders sin completar" >&2; exit 1; }
fi

# Sin EAS_PROJECT_ID el APK sale con `updates.url` vacía y no recibe ningún OTA, sin
# avisar (#384). Se chequea con la misma cadena de dotenv que arma app.config.js.
node -e '
  const path = require("path");
  for (const archivo of ["../.env", ".env", ".env.staging"]) {
    require("dotenv").config({ path: path.resolve(archivo), override: true });
  }
  const id = process.env.EAS_PROJECT_ID || "";
  process.exit(id && !id.includes("<") ? 0 : 1);
' >/dev/null 2>&1 || {
  echo "ERROR: falta EAS_PROJECT_ID en .env (raíz); el APK no recibiría updates OTA" >&2
  echo "       Está en el dashboard de expo.dev → proyecto Bayka → Project ID" >&2
  exit 1
}

# --- Prebuild limpio de la variante ------------------------------------------
echo ">>> [$VARIANT] expo prebuild --clean"
npx expo prebuild -p android --clean

# --- Gradle (single-ABI por default, con retry por la race de worklets) -------
ABI_FLAG="-PreactNativeArchitectures=arm64-v8a"
[ "${ABIS:-}" = "all" ] && ABI_FLAG=""
echo ">>> [$VARIANT] gradlew assembleRelease ${ABI_FLAG:-(todas las ABIs)}"
cd android
./gradlew assembleRelease $ABI_FLAG --no-daemon \
  || ./gradlew assembleRelease $ABI_FLAG --no-daemon
cd ..

# --- Artefacto + verificación de variante -------------------------------------
cp android/app/build/outputs/apk/release/app-release.apk "$ARTIFACT"
AAPT="$(ls "$ANDROID_HOME"/build-tools/*/aapt | sort -V | tail -1)"
BADGING="$("$AAPT" dump badging "$ARTIFACT")"
PKG="$(echo "$BADGING" | sed -n "s/^package: name='\([^']*\)'.*/\1/p")"
LABEL="$(echo "$BADGING" | sed -n "s/^application-label:'\([^']*\)'.*/\1/p" | head -1)"
if [ "$PKG" != "$EXPECTED_PKG" ] || [ "$LABEL" != "$EXPECTED_LABEL" ]; then
  echo "ERROR: el APK no corresponde a la variante '$VARIANT' (package=$PKG, label=$LABEL)" >&2
  exit 1
fi

# El canal de OTA se grabó en el manifest o no, y desde la app no hay forma de
# saberlo (#384): se reporta acá. Informativo, no corta el build.
CANAL="?"
if echo "$("$AAPT" dump xmltree "$ARTIFACT" AndroidManifest.xml 2>/dev/null)" \
  | grep "expo-channel-name" | grep -q "$EXPECTED_CANAL"; then
  CANAL="$EXPECTED_CANAL"
else
  echo "AVISO: no se pudo confirmar el canal '$EXPECTED_CANAL' en el manifest del APK." >&2
  echo "       Si es así, este APK no recibiría updates OTA (ver #384)." >&2
fi

echo ""
echo "APK $VARIANT listo!"
echo "  APK:     mobile/$ARTIFACT"
echo "  Package: $PKG"
echo "  Label:   $LABEL"
echo "  Canal:   $CANAL"
echo "  Size:    $(du -h "$ARTIFACT" | cut -f1)"
echo ""
echo "Instalar en dispositivo conectado:  adb install -r mobile/$ARTIFACT"
