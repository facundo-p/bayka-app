/**
 * Qué entra en el fingerprint que usa `runtimeVersion: { policy: 'fingerprint' }` (#678).
 * Solo se saltea lo que no toca el binario nativo; todo lo demás tiene que cambiarlo.
 *
 * - `extra`: lo lee el JS y viaja en cada OTA. En la variante TEST lleva el commit del
 *   build, así que con `extra` adentro cada commit daría otro fingerprint y ningún OTA
 *   llegaría a un APK TEST.
 * - `scripts` de package.json: no llegan al APK.
 *
 * @type {import('expo/fingerprint').Config}
 */
module.exports = {
  sourceSkips: ['ExpoConfigExtraSection', 'PackageJsonScriptsAll'],
};
