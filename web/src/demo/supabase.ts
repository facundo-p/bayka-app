/**
 * Cliente Supabase falso para `npm run dev:demo`. Implementa el pedacito de la
 * API que usa la web (constructor de consultas encadenable, rpc, auth) contra
 * los datos de `datos.ts`, sin red.
 *
 * `vite.demo.config.ts` lo pone en lugar de `lib/supabase` por alias, así que
 * ningún módulo de producción lo importa y nunca entra al bundle.
 */
import {
  contarEn,
  RPC,
  SESION_DEMO,
  TABLAS,
  type FilaDemo,
  cumpleFiltro,
  type FiltroDemo,
} from './datos';

type RespuestaDemo = {
  data: FilaDemo | FilaDemo[] | null;
  error: null;
  count?: number;
};

type OpcionesSelect = { head?: boolean; count?: string };

/** Sólo los métodos que la web encadena; el resto no hace falta simularlo. */
interface ConsultaDemo extends PromiseLike<RespuestaDemo> {
  select: (columnas?: string, opciones?: OpcionesSelect) => ConsultaDemo;
  eq: (columna: string, valor: unknown) => ConsultaDemo;
  neq: (columna: string, valor: unknown) => ConsultaDemo;
  in: (columna: string, valores: unknown[]) => ConsultaDemo;
  is: (columna: string, valor: unknown) => ConsultaDemo;
  not: (columna: string, operador: string, valor: unknown) => ConsultaDemo;
  gte: (columna: string, valor: unknown) => ConsultaDemo;
  lte: (columna: string, valor: unknown) => ConsultaDemo;
  ilike: (columna: string, patron: string) => ConsultaDemo;
  order: (columna: string, opciones?: { ascending?: boolean }) => ConsultaDemo;
  limit: (cantidad: number) => ConsultaDemo;
  range: (desde: number, hasta: number) => ConsultaDemo;
  maybeSingle: () => Promise<RespuestaDemo>;
  single: () => Promise<RespuestaDemo>;
}

function crearConsulta(nombreTabla: string): ConsultaDemo {
  const filtros: FiltroDemo[] = [];
  let soloConteo = false;
  let unaFila = false;

  const resolver = (): RespuestaDemo => {
    const tabla = TABLAS[nombreTabla];
    if (!tabla) return { data: unaFila ? null : [], error: null, count: 0 };
    if (soloConteo) {
      const total = tabla.contar ? tabla.contar(filtros) : contarEn(tabla.filas, filtros);
      return { data: null, error: null, count: total };
    }
    const filas = tabla.filas.filter((fila) =>
      filtros.every((filtro) => cumpleFiltro(fila, filtro)),
    );
    if (unaFila) return { data: filas[0] ?? null, error: null };
    return { data: filas, error: null, count: filas.length };
  };

  const consulta: ConsultaDemo = {
    select: (_columnas?: string, opciones?: OpcionesSelect) => {
      if (opciones?.head) soloConteo = true;
      return consulta;
    },
    eq: (columna, valor) => {
      filtros.push({ columna, valor });
      return consulta;
    },
    // `not(col, 'is', null)` sí cambia el resultado: sin él los árboles sin GPS
    // llegan al mapa con `latitude: null` y Leaflet tira abajo la pantalla
    // entera. El resto no hace falta: con datos de mentira alcanza con los eq.
    not: (columna, operador, valor) => {
      if (operador === 'is') filtros.push({ columna, valor, excluye: true });
      return consulta;
    },
    neq: () => consulta,
    in: () => consulta,
    is: () => consulta,
    gte: () => consulta,
    lte: () => consulta,
    ilike: () => consulta,
    order: () => consulta,
    limit: () => consulta,
    range: () => consulta,
    maybeSingle: () => {
      unaFila = true;
      return Promise.resolve(resolver());
    },
    single: () => {
      unaFila = true;
      return Promise.resolve(resolver());
    },
    then: (alCumplir, alFallar) => Promise.resolve(resolver()).then(alCumplir, alFallar),
  };
  return consulta;
}

/** `?sinSesion` arranca sin sesión. Es la única forma de ver el login acá: con
 *  sesión redirige al listado, así que sin esto una captura de `/login` es en
 *  realidad una captura de `/plantaciones`. */
const SIN_SESION = new URLSearchParams(window.location.search).has('sinSesion');

export const supabase = {
  from: (tabla: string) => crearConsulta(tabla),
  rpc: (nombre: string) => Promise.resolve({ data: RPC[nombre] ?? [], error: null }),
  auth: {
    getSession: () =>
      Promise.resolve({ data: { session: SIN_SESION ? null : SESION_DEMO }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: () => Promise.resolve({ error: null }),
    signOut: () => Promise.resolve({ error: null }),
    updateUser: () => Promise.resolve({ error: null }),
  },
  storage: {
    from: () => ({
      createSignedUrl: () => Promise.resolve({ data: null, error: null }),
    }),
  },
  functions: {
    invoke: () => Promise.resolve({ data: { ok: true }, error: null }),
  },
};
