/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { definirConstantesBuild } from './constantesBuild';
import { diagnosticarEnvSupabase } from './src/lib/envSupabase';

// Corta el build si el par VITE_SUPABASE_* es incoherente: las variables se
// hornean acá, así que un valor mal cargado en el hosting recién se notaría
// como un 401 al loguearse, ya deployado (#271).
function chequearEnvSupabase(): Plugin {
  return {
    name: 'chequear-env-supabase',
    config(_, { mode }) {
      if (process.env.VITEST) return;
      const env = loadEnv(mode, process.cwd(), 'VITE_');
      const diagnosticos = diagnosticarEnvSupabase(
        env.VITE_SUPABASE_URL,
        env.VITE_SUPABASE_ANON_KEY,
      );
      for (const { nivel, mensaje } of diagnosticos) {
        if (nivel === 'aviso') console.warn(`[supabase] ${mensaje}`);
      }
      const errores = diagnosticos.filter((d) => d.nivel === 'error');
      if (errores.length) {
        throw new Error(
          `Config de Supabase inválida:\n${errores.map((d) => d.mensaje).join('\n')}`,
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), chequearEnvSupabase()],
  define: definirConstantesBuild(),
  // Permite que vitest cargue los tests de fuera de web/.
  server: { fs: { allow: ['..'] } },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globals: true,
    // Suma la lógica de las edge functions (nucleo.ts, sin imports de Deno; el
    // entry index.ts es solo-Deno y queda afuera) y los scripts de la raíz.
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      '../supabase/functions/**/*.test.ts',
      '../scripts/**/*.test.ts',
    ],
    // Config dummy de Supabase para los tests: sin web/.env (p.ej. en CI) el
    // cliente lanzaría al importarse. Los tests mockean las llamadas reales.
    env: { VITE_SUPABASE_URL: 'http://localhost', VITE_SUPABASE_ANON_KEY: 'anon-test' },
  },
});
