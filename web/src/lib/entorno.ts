/**
 * Entorno horneado en build (#287). Único lector de las constantes de
 * compilación de vite.config.ts; los componentes importan de acá, así los
 * tests las mockean con vi.mock sin depender de test.env.
 */
export const ES_ENTORNO_DE_PRUEBAS: boolean = __ENTORNO_PRUEBAS__;
/** "v1.1.0": mismo formato que `formatearVersionApp` de mobile. */
export const VERSION_APP = `v${__VERSION_APP__}`;
