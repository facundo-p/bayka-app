/**
 * plugin-react de vite.config.ts y vite.demo.config.ts. `src/pdf/` va sin Fast
 * Refresh: su preámbulo usa `window` y el reporte de árboles se arma en un
 * worker (#849). Esos componentes no se pintan en la página: no pierden nada.
 */
import react from '@vitejs/plugin-react';

export const pluginReact = () => react({ exclude: /\/src\/pdf\// });
