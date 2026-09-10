/**
 * Cliente Supabase falso para `npm run dev:demo`. Implementa el pedacito de la
 * API que usa la web (constructor de consultas encadenable, rpc, auth) contra
 * los datos de `datos.ts`, sin red.
 *
 * `vite.demo.config.ts` lo pone en lugar de `lib/supabase` por alias, así que
 * ningún módulo de producción lo importa y nunca entra al bundle.
 */
import { RPC, SESION_DEMO, TABLAS, type FilaDemo, type TablaDemo } from './datos';
import { conEmbebidos, embebidosDe, type Embebido } from './embebidos';
import {
  OPERADOR,
  alternativasDe,
  cumpleTodos,
  modelaTodos,
  negacion,
  type FiltroDemo,
  type Operador,
} from './filtros';

/** Parámetro de URL que arranca sin sesión. Es la única forma de ver el login
 *  acá: con sesión redirige al listado, así que sin esto una captura de
 *  `/login` es en realidad una captura de `/plantaciones`. */
export const PARAMETRO_SIN_SESION = 'sinSesion';

type RespuestaDemo = {
  data: FilaDemo | FilaDemo[] | null;
  error: null;
  count?: number;
};

type OpcionesSelect = { head?: boolean; count?: string };

type MetodoDeFiltro = (columna: string, valor: unknown) => ConsultaDemo;

/** Sólo los métodos que la web encadena; el resto no hace falta simularlo. */
interface ConsultaDemo extends PromiseLike<RespuestaDemo>, Record<Operador, MetodoDeFiltro> {
  select: (columnas?: string, opciones?: OpcionesSelect) => ConsultaDemo;
  not: (columna: string, operador: string, valor: unknown) => ConsultaDemo;
  or: (condiciones: string) => ConsultaDemo;
  order: () => ConsultaDemo;
  limit: (cantidad: number) => ConsultaDemo;
  range: (desde: number, hasta: number) => ConsultaDemo;
  maybeSingle: () => Promise<RespuestaDemo>;
  single: () => Promise<RespuestaDemo>;
}

/** Filas de `desde` a `hasta` inclusive, como `range` de PostgREST. */
type Ventana = { desde: number; hasta: number };

type EstadoConsulta = {
  tabla: string;
  filtros: FiltroDemo[];
  embebidos: Embebido[];
  ventana: Ventana | null;
  soloConteo: boolean;
  unaFila: boolean;
};

type Cambiar = (cambio: Partial<EstadoConsulta>) => ConsultaDemo;

function filasQueEntran(filas: FilaDemo[], { filtros, embebidos }: EstadoConsulta): FilaDemo[] {
  return filas
    .map((fila) => conEmbebidos(fila, embebidos))
    .filter((fila) => cumpleTodos(fila, filtros));
}

/** `conteos` da el total sin materializar las filas. Si un filtro pide una
 *  columna que no modela, ignorarlo inflaría el conteo: se cuentan las filas. */
function contar({ filas, conteos }: TablaDemo, estado: EstadoConsulta): number {
  const modelados = conteos?.every(({ fila }) => modelaTodos(fila, estado.filtros));
  if (!conteos || !modelados) return filasQueEntran(filas, estado).length;
  return conteos
    .filter(({ fila }) => cumpleTodos(fila, estado.filtros))
    .reduce((total, { cantidad }) => total + cantidad, 0);
}

function recortar(filas: FilaDemo[], ventana: Ventana | null): FilaDemo[] {
  return ventana ? filas.slice(ventana.desde, ventana.hasta + 1) : filas;
}

/** Como `count: 'exact'` de PostgREST: el total es de todo lo que entra, no de la página. */
function resolver(estado: EstadoConsulta): RespuestaDemo {
  const tabla = TABLAS[estado.tabla];
  if (!tabla) return { data: estado.unaFila ? null : [], error: null, count: 0 };
  if (estado.soloConteo) return { data: null, error: null, count: contar(tabla, estado) };
  const filas = filasQueEntran(tabla.filas, estado);
  if (estado.unaFila) return { data: filas[0] ?? null, error: null };
  return { data: recortar(filas, estado.ventana), error: null, count: filas.length };
}

function metodosDeFiltro(agregar: (filtro: FiltroDemo) => ConsultaDemo): Record<Operador, MetodoDeFiltro> {
  const metodos = Object.values(OPERADOR).map((operador) => [
    operador,
    (columna: string, valor: unknown) => agregar({ columna, operador, valor }),
  ]);
  return Object.fromEntries(metodos) as Record<Operador, MetodoDeFiltro>;
}

/** `order` no cambia nada: las fixtures ya vienen en el orden en que las muestran las pantallas. */
function metodosDePagina(cambiar: Cambiar): Pick<ConsultaDemo, 'order' | 'limit' | 'range'> {
  return {
    order: () => cambiar({}),
    limit: (cantidad) => cambiar({ ventana: { desde: 0, hasta: cantidad - 1 } }),
    range: (desde, hasta) => cambiar({ ventana: { desde, hasta } }),
  };
}

function estadoInicial(tabla: string): EstadoConsulta {
  return { tabla, filtros: [], embebidos: [], ventana: null, soloConteo: false, unaFila: false };
}

function crearConsulta(tabla: string): ConsultaDemo {
  const estado = estadoInicial(tabla);
  const cambiar: Cambiar = (cambio) => {
    Object.assign(estado, cambio);
    return consulta;
  };
  const agregar = (filtro: FiltroDemo) => cambiar({ filtros: [...estado.filtros, filtro] });
  const unaSola = () => Promise.resolve(resolver({ ...estado, unaFila: true }));
  const consulta: ConsultaDemo = {
    ...metodosDeFiltro(agregar),
    ...metodosDePagina(cambiar),
    select: (columnas = '', opciones) =>
      cambiar({ embebidos: embebidosDe(columnas), soloConteo: Boolean(opciones?.head) }),
    not: (columna, operador, valor) => agregar(negacion(columna, operador, valor)),
    or: (condiciones) => agregar(alternativasDe(condiciones)),
    maybeSingle: unaSola,
    single: unaSola,
    then: (alCumplir, alFallar) => Promise.resolve(resolver(estado)).then(alCumplir, alFallar),
  };
  return consulta;
}

const SIN_SESION = new URLSearchParams(window.location.search).has(PARAMETRO_SIN_SESION);

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
