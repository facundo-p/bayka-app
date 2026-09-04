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
