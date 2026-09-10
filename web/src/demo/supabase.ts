/**
 * Cliente Supabase falso para `npm run dev:demo`. Implementa el pedacito de la
 * API que usa la web (constructor de consultas encadenable, rpc, auth) contra
 * los datos de `datos.ts`, sin red.
 *
 * `vite.demo.config.ts` lo pone en lugar de `lib/supabase` por alias, así que
 * ningún módulo de producción lo importa y nunca entra al bundle.
 */
import {
  COLUMNA_QUE_APUNTA_A,
  RPC,
  SESION_DEMO,
  TABLAS,
  type FilaDemo,
  type FiltroDemo,
} from './datos';

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

/** La web los encadena pero con datos de mentira alcanza con `eq` y `not`. */
const METODOS_SIN_EFECTO = ['neq', 'in', 'is', 'gte', 'lte', 'ilike', 'order', 'limit', 'range'] as const;
type MetodoSinEfecto = (typeof METODOS_SIN_EFECTO)[number];

/** Sólo los métodos que la web encadena; el resto no hace falta simularlo. */
interface ConsultaDemo
  extends PromiseLike<RespuestaDemo>,
    Record<MetodoSinEfecto, () => ConsultaDemo> {
  select: (columnas?: string, opciones?: OpcionesSelect) => ConsultaDemo;
  eq: (columna: string, valor: unknown) => ConsultaDemo;
  not: (columna: string, operador: string, valor: unknown) => ConsultaDemo;
  maybeSingle: () => Promise<RespuestaDemo>;
  single: () => Promise<RespuestaDemo>;
}

/** `tabla(...)` o `tabla!inner(...)` dentro de un select, con sus propios embebidos. */
type Embebido = { tabla: string; anidados: Embebido[] };

const PATRON_EMBEBIDO = /^(\w+)(?:!\w+)?\((.*)\)$/;

type EstadoConsulta = {
  tabla: string;
  filtros: FiltroDemo[];
  embebidos: Embebido[];
  soloConteo: boolean;
  unaFila: boolean;
};

/** Columnas de primer nivel: las comas de adentro de un embebido no cortan. */
function partirNivelSuperior(columnas: string): string[] {
  const partes = [''];
  let profundidad = 0;
  for (const caracter of columnas) {
    if (caracter === '(') profundidad += 1;
    if (caracter === ')') profundidad -= 1;
    if (caracter === ',' && profundidad === 0) partes.push('');
    else partes[partes.length - 1] += caracter;
  }
  return partes.map((parte) => parte.trim());
}

function embebidosDe(columnas: string): Embebido[] {
  return partirNivelSuperior(columnas).flatMap((columna) => {
    const coincidencia = PATRON_EMBEBIDO.exec(columna);
    return coincidencia ? [{ tabla: coincidencia[1], anidados: embebidosDe(coincidencia[2]) }] : [];
  });
}

/** Solo many-to-one, que es lo único que embebe la web: PostgREST lo devuelve
 *  como objeto, o null si la FK no apunta a nada. Si la fila no tiene la FK
 *  (one-to-many, que llegaría como array), el embebido no se agrega. */
function conEmbebidos(fila: FilaDemo, embebidos: Embebido[]): FilaDemo {
  const resuelta = { ...fila };
  for (const embebido of embebidos) {
    const columna = COLUMNA_QUE_APUNTA_A[embebido.tabla];
    if (columna && columna in fila) resuelta[embebido.tabla] = filaApuntada(fila[columna], embebido);
  }
  return resuelta;
}

function filaApuntada(id: unknown, { tabla, anidados }: Embebido): FilaDemo | null {
  const apuntada = TABLAS[tabla]?.filas.find((fila) => fila.id === id);
  return apuntada ? conEmbebidos(apuntada, anidados) : null;
}

/** ¿La fila pasa el filtro? Una columna que los datos no modelan no filtra. */
function cumpleFiltro(fila: FilaDemo, { columna, valor, excluye }: FiltroDemo): boolean {
  if (!(columna in fila)) return true;
  return excluye ? fila[columna] !== valor : fila[columna] === valor;
}

function filtrarEn(filas: FilaDemo[], filtros: FiltroDemo[]): FilaDemo[] {
  return filas.filter((fila) => filtros.every((filtro) => cumpleFiltro(fila, filtro)));
}

function resolver(estado: EstadoConsulta): RespuestaDemo {
  const { tabla: nombre, filtros, embebidos, soloConteo, unaFila } = estado;
  const tabla = TABLAS[nombre];
  if (!tabla) return { data: unaFila ? null : [], error: null, count: 0 };
  if (soloConteo) {
    const total = tabla.contar ? tabla.contar(filtros) : filtrarEn(tabla.filas, filtros).length;
    return { data: null, error: null, count: total };
  }
  const filas = filtrarEn(tabla.filas, filtros).map((fila) => conEmbebidos(fila, embebidos));
  if (unaFila) return { data: filas[0] ?? null, error: null };
  return { data: filas, error: null, count: filas.length };
}

function crearConsulta(tabla: string): ConsultaDemo {
  const estado: EstadoConsulta = {
    tabla,
    filtros: [],
    embebidos: [],
    soloConteo: false,
    unaFila: false,
  };
  const unaSola = () => {
    estado.unaFila = true;
    return Promise.resolve(resolver(estado));
  };
  const sinEfecto = Object.fromEntries(
    METODOS_SIN_EFECTO.map((metodo) => [metodo, () => consulta]),
  ) as Record<MetodoSinEfecto, () => ConsultaDemo>;

  const consulta: ConsultaDemo = {
    ...sinEfecto,
    select: (columnas = '', opciones) => {
      estado.embebidos = embebidosDe(columnas);
      if (opciones?.head) estado.soloConteo = true;
      return consulta;
    },
    eq: (columna, valor) => {
      estado.filtros.push({ columna, valor });
      return consulta;
    },
    // `not(col, 'is', null)` sí cambia el resultado: sin él los árboles sin GPS
    // llegan al mapa con `latitude: null` y Leaflet tira abajo la pantalla entera.
    not: (columna, operador, valor) => {
      if (operador === 'is') estado.filtros.push({ columna, valor, excluye: true });
      return consulta;
    },
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
