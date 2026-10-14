#!/usr/bin/env bash
# ¿El OTA que se publicaría para <canal> le llega al APK local de ese canal? (#678)
# Compara el fingerprint del working tree, resuelto con la variante del canal, con el
# que tiene grabado el APK. Sale con 0 si coinciden, 1 si difieren, 2 si no se pudo.
#
#   .claude/skills/push-update-apk/scripts/fingerprint-vs-apk.sh <test|production>
set -euo pipefail

# Canal → variante y APK: contrato con CANAL_OTA de mobile/app.config.js y con
# mobile/scripts/build-apk.sh.
case "${1:-}" in
  test)       VARIANTE="test"; APK="build-output-test.apk" ;;
  production) VARIANTE="";     APK="build-output.apk" ;;
  *) echo "Uso: $0 <test|production>" >&2; exit 2 ;;
esac

cd "$(git rev-parse --show-toplevel)/mobile"
if [ ! -f "$APK" ]; then
  echo "No está mobile/$APK: compilarlo o pedir el fingerprint del APK de los devices." >&2
  exit 2
fi

if [ -n "$VARIANTE" ]; then export APP_VARIANT="$VARIANTE"; else unset APP_VARIANT; fi
LOCAL="$(npx expo-updates runtimeversion:resolve --platform android 2>/dev/null | tail -1 \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).runtimeVersion))')" \
  || { echo "No se pudo resolver el fingerprint del working tree." >&2; exit 2; }
# Sin assets/fingerprint el APK se compiló con runtime appVersion (<= mobile 1.3.0).
DEL_APK="$(unzip -p "$APK" assets/fingerprint 2>/dev/null)" || DEL_APK="(sin fingerprint)"

echo "Canal:          $1 (APP_VARIANT=${APP_VARIANT:-})"
echo "Working tree:   $LOCAL"
echo "mobile/$APK: $DEL_APK"
if [ "$LOCAL" = "$DEL_APK" ]; then
  echo "Coinciden: el OTA le llega a ese APK."
else
  echo "DIFIEREN: el OTA no le llegaría a ese APK." >&2
  exit 1
fi
