/**
 * Variantes de build de mobile y su canal de EAS Update. CommonJS y sin side
 * effects: lo requieren `mobile/app.config.js` y el skill push-update-apk.
 */

// Valores de APP_VARIANT y de extra.appVariant: contrato con APP_VARIANT_TEST
// (src/config/entorno.ts), eas.json y scripts/build-apk.sh.
const VARIANTE = Object.freeze({ test: 'test', prod: 'prod' });

// Canal de EAS Update por variante (#384). Contrato con los channel de eas.json.
const CANAL_OTA = Object.freeze({ test: 'test', prod: 'production' });

module.exports = { VARIANTE, CANAL_OTA };
