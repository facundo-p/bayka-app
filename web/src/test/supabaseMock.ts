/**
 * Mock compartido del cliente Supabase para tests de auth.
 * Uso en cada test file (la factory async evita problemas de hoisting):
 *
 *   vi.mock('../lib/supabase', async () => {
 *     const { supabaseMock } = await import('./test/supabaseMock');
 *     return { supabase: supabaseMock };
 *   });
 */
import { vi } from 'vitest';

type SesionMock = { user: { id: string; email?: string } };

export type PerfilFilaMock = {
  id: string;
  nombre: string;
  rol: string;
  organizacion_id: string;
};

type OyenteAuth = (evento: string, sesion: SesionMock | null) => void;

const oyentes = new Set<OyenteAuth>();

/** Estado mutable que cada test configura antes de renderizar. */
export const estadoMock: {
  sesion: SesionMock | null;
  perfilFila: PerfilFilaMock | null;
  errorPerfil: { message: string } | null;
  errorSignIn: { message: string } | null;
} = { sesion: null, perfilFila: null, errorPerfil: null, errorSignIn: null };

export function resetEstadoMock(): void {
  estadoMock.sesion = null;
  estadoMock.perfilFila = null;
  estadoMock.errorPerfil = null;
  estadoMock.errorSignIn = null;
  oyentes.clear();
}

export const PERFIL_ADMIN: PerfilFilaMock = {
  id: 'user-1',
  nombre: 'Ana Admin',
  rol: 'admin',
  organizacion_id: 'org-1',
};

export const PERFIL_TECNICO: PerfilFilaMock = {
  ...PERFIL_ADMIN,
  nombre: 'Teo Técnico',
  rol: 'tecnico',
};

function emitir(evento: string): void {
  for (const oyente of oyentes) oyente(evento, estadoMock.sesion);
}

export const supabaseMock = {
  auth: {
    getSession: vi.fn(async () => ({ data: { session: estadoMock.sesion } })),
    onAuthStateChange: vi.fn((oyente: OyenteAuth) => {
      oyentes.add(oyente);
      return { data: { subscription: { unsubscribe: () => oyentes.delete(oyente) } } };
    }),
    signInWithPassword: vi.fn(async ({ email }: { email: string; password: string }) => {
      if (estadoMock.errorSignIn) {
        return { data: { session: null }, error: estadoMock.errorSignIn };
      }
      estadoMock.sesion = { user: { id: 'user-1', email } };
      emitir('SIGNED_IN');
      return { data: { session: estadoMock.sesion }, error: null };
    }),
    signOut: vi.fn(async () => {
      estadoMock.sesion = null;
      emitir('SIGNED_OUT');
      return { error: null };
    }),
  },
  from: vi.fn(() => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () =>
          estadoMock.errorPerfil
            ? { data: null, error: estadoMock.errorPerfil }
            : { data: estadoMock.perfilFila, error: null },
      }),
    }),
  })),
};
