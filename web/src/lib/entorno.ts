/**
 * Único lector de las constantes de compilación de constantesBuild.ts; los
 * componentes importan de acá, así los tests las mockean con vi.mock sin
 * depender de test.env.
 */
export const ES_ENTORNO_DE_PRUEBAS: boolean = __ENTORNO_PRUEBAS__;

function formatearVersion(version: string): string {
  return `v${version}`;
}

/** "v1.1.0": mismo formato que `formatearVersionApp` de mobile. */
export const VERSION_APP = formatearVersion(__VERSION_APP__);

/**
 * "v1.1.0 · a1b2c3d" (#321): la versión ubica la línea de release y el commit
 * identifica el build. Misma firma y formato que en `mobile/src/config/entorno.ts`.
 */
export function formatearEtiquetaBuild(version: string, commit?: string): string {
  const etiqueta = formatearVersion(version);
  return commit ? `${etiqueta} · ${commit}` : etiqueta;
}

export const ETIQUETA_BUILD = formatearEtiquetaBuild(__VERSION_APP__, __COMMIT_APP__);
