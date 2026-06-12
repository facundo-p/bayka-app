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
import {
  crearConsultaMock,
  type ConsultaCapturada,
  type ResolverConsulta,
} from './queryBuilderMock';

type SesionMock = { user: { id: string; email?: string } };

export type PerfilFilaMock = {
  id: string;
  nombre: string;
  rol: string;
  organizacion_id: string;
};

type OyenteAuth = (evento: string, sesion: SesionMock | null) => void;

const oyentes = new Set<OyenteAuth>();

/** Llamada a `storage.createSignedUrl` capturada por el mock. */
export type FirmaCapturada = { bucket: string; path: string; segundos: number };

/** Estado mutable que cada test configura antes de renderizar. */
export const estadoMock: {
  sesion: SesionMock | null;
  perfilFila: PerfilFilaMock | null;
  errorPerfil: { message: string } | null;
  errorSignIn: { message: string } | null;
  /** Resolver para tablas distintas de `profiles` (listados, counts). */
  resolverConsulta: ResolverConsulta | null;
  /** Error a devolver al firmar URLs de Storage (null = firma OK). */
  errorFirma: { message: string } | null;
  /** URLs firmadas pedidas durante el test. */
  firmas: FirmaCapturada[];
} = {
  sesion: null,
  perfilFila: null,
  errorPerfil: null,
  errorSignIn: null,
  resolverConsulta: null,
  errorFirma: null,
  firmas: [],
};

export function resetEstadoMock(): void {
  estadoMock.sesion = null;
  estadoMock.perfilFila = null;
  estadoMock.errorPerfil = null;
  estadoMock.errorSignIn = null;
  estadoMock.resolverConsulta = null;
  estadoMock.errorFirma = null;
  estadoMock.firmas = [];
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
  from: vi.fn((tabla: string) => crearConsultaMock(tabla, resolverPorDefecto)),
  storage: {
    from: vi.fn((bucket: string) => ({
      createSignedUrl: vi.fn(async (path: string, segundos: number) => {
        estadoMock.firmas.push({ bucket, path, segundos });
        if (estadoMock.errorFirma) return { data: null, error: estadoMock.errorFirma };
        return { data: { signedUrl: `https://firmada.test/${path}` }, error: null };
      }),
    })),
  },
};

/** El lookup del perfil de auth filtra `profiles` por id; los listados
 *  (listarPerfiles) consultan la tabla sin ese filtro. */
function esPerfilDeAuth(consulta: ConsultaCapturada): boolean {
  return (
    consulta.tabla === 'profiles' &&
    consulta.filtros.some((filtro) => filtro.metodo === 'eq' && filtro.columna === 'id')
  );
}

/** El perfil de auth se resuelve con el estado de sesión; el resto delega en
 *  el resolver configurado por el test (o devuelve vacío). */
function resolverPorDefecto(consulta: ConsultaCapturada) {
  if (esPerfilDeAuth(consulta)) {
    return estadoMock.errorPerfil
      ? { data: null, error: estadoMock.errorPerfil }
      : { data: estadoMock.perfilFila, error: null };
  }
  if (estadoMock.resolverConsulta) return estadoMock.resolverConsulta(consulta);
  return { data: [], error: null, count: 0 };
}
