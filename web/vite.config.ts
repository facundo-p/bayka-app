/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globals: true,
    // Config dummy de Supabase para los tests: sin web/.env (p.ej. en CI) el
    // cliente lanzaría al importarse. Los tests mockean las llamadas reales.
    env: { VITE_SUPABASE_URL: 'http://localhost', VITE_SUPABASE_ANON_KEY: 'anon-test' },
  },
});
