/**
 * Servidor de desarrollo con datos de mentira: `npm run dev:demo`.
 *
 * Reemplaza `lib/supabase` por el cliente falso de `src/demo/`, así la app
 * levanta sin backend, sin login y con datos verosímiles. Sirve para revisar
 * layout y fidelidad visual — que es donde los tests no llegan — y para mostrar
 * la app sin tocar datos reales.
 *
 * El banner de entorno de pruebas viene prendido a propósito (nada de lo que se
 * ve es real). `DEMO_BANNER=0 npm run dev:demo` lo apaga para medir la pantalla
 * sin los 26px de la franja.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { definirConstantesBuild } from './constantesBuild';

const clienteFalso = fileURLToPath(new URL('./src/demo/supabase.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  define: definirConstantesBuild(process.env.DEMO_BANNER !== '0'),
  // Los imports son relativos ('../lib/supabase', '../../lib/supabase'): el
  // alias se aplica sobre el especificador crudo, así que va por regex.
  resolve: {
    alias: [{ find: /^(?:\.\.\/)+lib\/supabase$/, replacement: clienteFalso }],
  },
  server: { port: 5199, strictPort: true },
});
