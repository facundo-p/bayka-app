/**
 * Único lector de las constantes de compilación de vite.config.ts; los
 * componentes importan de acá, así los tests las mockean con vi.mock sin
 * depender de test.env.
 */
export const ES_ENTORNO_DE_PRUEBAS: boolean = __ENTORNO_PRUEBAS__;
/** "v1.1.0": mismo formato que `formatearVersionApp` de mobile. */
export const VERSION_APP = `v${__VERSION_APP__}`;

/**
 * "v1.1.0 · a1b2c3d" (#321). La versión ubica la línea de release y el commit
 * identifica el build: entre releases la versión no se mueve, porque `/deploy`
 * la bumpea recién al pasar a main. Espejo de `formatearEtiquetaBuild` de
 * mobile (`mobile/src/config/entorno.ts`): mantener los dos formatos iguales.
 */
export function formatearEtiquetaBuild(version: string, commit: string): string {
  const etiqueta = `v${version}`;
  return commit ? `${etiqueta} · ${commit}` : etiqueta;
}

export const ETIQUETA_BUILD = formatearEtiquetaBuild(__VERSION_APP__, __COMMIT_APP__);
