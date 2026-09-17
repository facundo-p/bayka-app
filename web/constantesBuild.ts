/**
 * Constantes de compilación (`define`) de vite.config.ts y vite.demo.config.ts.
 * Único lector en la app: src/lib/entorno.ts (tipos en src/vite-env.d.ts).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { esBranchDeProduccion } from './src/lib/entornoBranch';

// Con `import`, Vite bundlea el .cjs dentro de la config ESM y su `require` de
// node:child_process falla al cargarla; en runtime lo resuelve Node.
const { commitDelBuild }: typeof import('../scripts/commitDelBuild.cjs') = createRequire(
  import.meta.url,
)('../scripts/commitDelBuild.cjs');

const VERSION_APP: string = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
).version;

/** Cloudflare Pages inyecta CF_PAGES_BRANCH y solo `main` es prod; sin la var
 *  (dev local, CI) es pruebas. */
const ES_ENTORNO_PRUEBAS = !esBranchDeProduccion(process.env.CF_PAGES_BRANCH);

export function definirConstantesBuild(esEntornoPruebas = ES_ENTORNO_PRUEBAS) {
  return {
    __ENTORNO_PRUEBAS__: JSON.stringify(esEntornoPruebas),
    __VERSION_APP__: JSON.stringify(VERSION_APP),
    __COMMIT_APP__: JSON.stringify(commitDelBuild(process.env.CF_PAGES_COMMIT_SHA)),
  };
}
