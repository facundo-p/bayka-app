/**
 * Entorno de ejecución: variante TEST (Supabase staging, #253) vs producción.
 * Único lector de `Constants.expoConfig` para esto. `app.config.js` expone
 * `extra.appVariant` según `APP_VARIANT` en build; el banner "Entorno de
 * pruebas" (#287) y el ajuste de inset de `CustomHeader` salen de acá.
 */
import Constants from 'expo-constants';

/** Valor que `app.config.js` pone en `extra.appVariant` cuando `APP_VARIANT=test`. */
export const APP_VARIANT_TEST = 'test';

type ExtraConfig = { appVariant?: string } | undefined;
type VersionConfig = { version?: string; android?: { versionCode?: number } };

export function esVarianteDePruebas(extra: ExtraConfig): boolean {
  return extra?.appVariant === APP_VARIANT_TEST;
}

/** "v1.0.0 (3)": `expo.version` + `android.versionCode` de app.json. */
export function formatearVersionApp(config: VersionConfig): string {
  return `v${config.version} (${config.android?.versionCode})`;
}

export const ES_ENTORNO_DE_PRUEBAS = esVarianteDePruebas(Constants.expoConfig?.extra);
export const VERSION_APP = formatearVersionApp(Constants.expoConfig ?? {});
