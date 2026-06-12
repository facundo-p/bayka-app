/**
 * Builder encadenable que imita la API de consultas de Supabase
 * (`from().select().eq().order()`, `insert()/update()/delete()` + thenable).
 * Cada test define un resolver que recibe la consulta capturada y devuelve
 * `{ data, error, count }`.
 */

type Filtro = { metodo: 'eq' | 'is' | 'ilike' | 'neq'; columna: string; valor: unknown };

export type ConsultaCapturada = {
  tabla: string;
  operacion: 'select' | 'insert' | 'update' | 'delete';
  /** Filas/cambios pasados a insert/update. */
  payload?: unknown;
  columnas?: string;
  opciones?: { count?: string; head?: boolean };
  filtros: Filtro[];
  orden?: { columna: string; ascending: boolean };
};

export type RespuestaMock = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
};

export type ResolverConsulta = (consulta: ConsultaCapturada) => RespuestaMock;

function normalizar(respuesta: RespuestaMock): Required<RespuestaMock> {
  return {
    data: respuesta.data ?? null,
    error: respuesta.error ?? null,
    count: respuesta.count ?? null,
  };
}

/** Crea el builder para una tabla; el resolver se evalúa recién al await. */
export function crearConsultaMock(tabla: string, resolver: ResolverConsulta) {
  const consulta: ConsultaCapturada = { tabla, operacion: 'select', filtros: [] };
  const agregarFiltro = (metodo: Filtro['metodo']) => (columna: string, valor: unknown) => {
    consulta.filtros.push({ metodo, columna, valor });
    return builder;
  };
  const builder = {
    select(columnas: string, opciones?: ConsultaCapturada['opciones']) {
      consulta.columnas = columnas;
      consulta.opciones = opciones;
      return builder;
    },
    insert(payload: unknown) {
      consulta.operacion = 'insert';
      consulta.payload = payload;
      return builder;
    },
    update(payload: unknown) {
      consulta.operacion = 'update';
      consulta.payload = payload;
      return builder;
    },
    delete() {
      consulta.operacion = 'delete';
      return builder;
    },
    eq: agregarFiltro('eq'),
    is: agregarFiltro('is'),
    ilike: agregarFiltro('ilike'),
    neq: agregarFiltro('neq'),
    order(columna: string, opciones?: { ascending?: boolean }) {
      consulta.orden = { columna, ascending: opciones?.ascending ?? true };
      return builder;
    },
    maybeSingle: async () => normalizar(resolver(consulta)),
    single: async () => normalizar(resolver(consulta)),
    then(
      onFulfilled?: (valor: Required<RespuestaMock>) => unknown,
      onRejected?: (razon: unknown) => unknown,
    ) {
      return Promise.resolve()
        .then(() => normalizar(resolver(consulta)))
        .then(onFulfilled, onRejected);
    },
  };
  return builder;
}
