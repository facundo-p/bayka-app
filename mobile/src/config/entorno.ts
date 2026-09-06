/**
 * Entorno de ejecución: variante TEST (Supabase staging) vs producción. Único lector
 * de `Constants.expoConfig`; `app.config.js` expone `extra.appVariant` según
 * `APP_VARIANT` en build. El banner "Entorno de pruebas" y el ajuste de inset de
 * `CustomHeader` salen de acá.
 */
import Constants from 'expo-constants';

/** Valor que `app.config.js` pone en `extra.appVariant` cuando `APP_VARIANT=test`. */
export const APP_VARIANT_TEST = 'test';

type ExtraConfig = { appVariant?: string; commit?: string } | undefined;
type VersionConfig = { version?: string };

export function esVarianteDePruebas(extra: ExtraConfig): boolean {
  return extra?.appVariant === APP_VARIANT_TEST;
}

/** "v1.0.0": `expo.version` de app.json. */
export function formatearVersionApp(config: VersionConfig): string {
  return `v${config.version}`;
}

/**
 * "v1.0.0 · a1b2c3d" (#321). La versión ubica la línea de release y el commit
 * identifica el build: entre releases la versión no se mueve, porque `/deploy`
 * la bumpea recién al pasar a main. Tras un OTA el manifest trae el commit del
 * código nuevo, no el del APK instalado. Espejo de `formatearEtiquetaBuild` de
 * web (`web/src/lib/entorno.ts`): mantener los dos formatos iguales.
 */
export function formatearEtiquetaBuild(config: VersionConfig, extra: ExtraConfig): string {
  const version = formatearVersionApp(config);
  return extra?.commit ? `${version} · ${extra.commit}` : version;
}

export const ES_ENTORNO_DE_PRUEBAS = esVarianteDePruebas(Constants.expoConfig?.extra);
export const VERSION_APP = formatearVersionApp(Constants.expoConfig ?? {});
export const ETIQUETA_BUILD = formatearEtiquetaBuild(
  Constants.expoConfig ?? {},
  Constants.expoConfig?.extra,
);
