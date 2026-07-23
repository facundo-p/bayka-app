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
  activo: boolean;
  organizacion_id: string;
};

type OyenteAuth = (evento: string, sesion: SesionMock | null) => void;

const oyentes = new Set<OyenteAuth>();

/** Llamada a `storage.createSignedUrl` capturada por el mock. */
export type FirmaCapturada = { bucket: string; path: string; segundos: number };

/** Llamada a `functions.invoke` capturada por el mock. */
export type InvocacionCapturada = { funcion: string; cuerpo: Record<string, unknown> };

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
  /** Respuesta de functions.invoke (null = { ok: true } sin error). */
  respuestaInvoke: { data: unknown; error: unknown } | null;
  /** Invocaciones a edge functions capturadas. */
  invocaciones: InvocacionCapturada[];
  /** Error a devolver en auth.updateUser (null = éxito). */
  errorUpdateUser: { message: string } | null;
  /** Payloads de auth.updateUser capturados. */
  actualizacionesUsuario: Array<Record<string, unknown>>;
} = {
  sesion: null,
  perfilFila: null,
  errorPerfil: null,
  errorSignIn: null,
  resolverConsulta: null,
  errorFirma: null,
  firmas: [],
  respuestaInvoke: null,
  invocaciones: [],
  errorUpdateUser: null,
  actualizacionesUsuario: [],
};

export function resetEstadoMock(): void {
  estadoMock.sesion = null;
  estadoMock.perfilFila = null;
  estadoMock.errorPerfil = null;
  estadoMock.errorSignIn = null;
  estadoMock.resolverConsulta = null;
  estadoMock.errorFirma = null;
  estadoMock.firmas = [];
  estadoMock.respuestaInvoke = null;
  estadoMock.invocaciones = [];
  estadoMock.errorUpdateUser = null;
  estadoMock.actualizacionesUsuario = [];
  oyentes.clear();
}

export const PERFIL_ADMIN: PerfilFilaMock = {
  id: 'user-1',
  nombre: 'Ana Admin',
  rol: 'admin',
  activo: true,
  organizacion_id: 'org-1',
};

export const PERFIL_TECNICO: PerfilFilaMock = {
  ...PERFIL_ADMIN,
  nombre: 'Teo Técnico',
  rol: 'tecnico',
};

export const PERFIL_SUPERADMIN: PerfilFilaMock = {
  ...PERFIL_ADMIN,
  nombre: 'Sofía Súper',
  rol: 'superadmin',
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
    updateUser: vi.fn(async (campos: Record<string, unknown>) => {
      estadoMock.actualizacionesUsuario.push(campos);
      if (estadoMock.errorUpdateUser) {
        return { data: { user: null }, error: estadoMock.errorUpdateUser };
      }
      return { data: { user: estadoMock.sesion?.user ?? null }, error: null };
    }),
  },
  functions: {
    invoke: vi.fn(async (funcion: string, opciones: { body: Record<string, unknown> }) => {
      estadoMock.invocaciones.push({ funcion, cuerpo: opciones.body });
      return estadoMock.respuestaInvoke ?? { data: { ok: true }, error: null };
    }),
  },
  from: vi.fn((tabla: string) => crearConsultaMock(tabla, resolverPorDefecto)),
  rpc: vi.fn(async (funcion: string, argumentos?: Record<string, unknown>) => {
    const respuesta = resolverPorDefecto({
      tabla: funcion,
      operacion: 'rpc',
      payload: argumentos,
      filtros: [],
    });
    return { data: respuesta.data ?? null, error: respuesta.error ?? null };
  }),
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

/** El lookup del perfil de auth es un select de `profiles` filtrado por id;
 *  los listados consultan sin ese filtro y las mutaciones (cambiarRol) no
 *  son selects: ambos van al resolver del test. */
function esPerfilDeAuth(consulta: ConsultaCapturada): boolean {
  return (
    consulta.tabla === 'profiles' &&
    consulta.operacion === 'select' &&
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
