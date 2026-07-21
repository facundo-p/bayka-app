/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Permite que vitest cargue los tests de supabase/functions (fuera de web/).
  server: { fs: { allow: ['..'] } },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globals: true,
    // La lógica de las edge functions (nucleo.ts, sin imports de Deno) se
    // testea con esta suite; el entry index.ts es solo-Deno y queda afuera.
    include: ['src/**/*.{test,spec}.{ts,tsx}', '../supabase/functions/**/*.test.ts'],
    // Config dummy de Supabase para los tests: sin web/.env (p.ej. en CI) el
    // cliente lanzaría al importarse. Los tests mockean las llamadas reales.
    env: { VITE_SUPABASE_URL: 'http://localhost', VITE_SUPABASE_ANON_KEY: 'anon-test' },
  },
});
