/**
 * `main` es producción; cualquier otra branch, preview o dev local es
 * entorno de pruebas. La usa vite.config.ts en build a partir de
 * CF_PAGES_BRANCH, que inyecta Cloudflare Pages. Sin globals de Vite a
 * propósito: importable desde la config y testeable.
 */
export const BRANCH_PRODUCCION = 'main';

export function esBranchDeProduccion(branch: string | undefined): boolean {
  return branch === BRANCH_PRODUCCION;
}

/** Largo del SHA corto, el mismo que usa `git rev-parse --short` por defecto. */
const LARGO_COMMIT_CORTO = 7;

/**
 * "a1b2c3d" / "a1b2c3d-dirty" para el banner de entorno (#321). `sucio` marca
 * builds hechos con cambios sin commitear (nunca pasa en Pages). Sin SHA
 * devuelve vacío: el banner degrada a mostrar solo la versión.
 */
export function abreviarCommit(sha: string | undefined, sucio: boolean): string {
  if (!sha) return '';
  return sha.slice(0, LARGO_COMMIT_CORTO) + (sucio ? '-dirty' : '');
}
