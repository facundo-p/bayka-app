/**
 * Builder encadenable que imita la API de consultas de Supabase
 * (`from().select().eq().order()` + thenable). Cada test define un resolver
 * que recibe la consulta capturada y devuelve `{ data, error, count }`.
 */

type Filtro = { metodo: 'eq' | 'is'; columna: string; valor: unknown };

export type ConsultaCapturada = {
  tabla: string;
  columnas?: string;
  opciones?: { count?: string; head?: boolean };
  filtros: Filtro[];
  orden?: { columna: string; ascending: boolean };
};

export type RespuestaMock = {
  data?: unknown;
  error?: { message: string } | null;
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
  const consulta: ConsultaCapturada = { tabla, filtros: [] };
  const builder = {
    select(columnas: string, opciones?: ConsultaCapturada['opciones']) {
      consulta.columnas = columnas;
      consulta.opciones = opciones;
      return builder;
    },
    eq(columna: string, valor: unknown) {
      consulta.filtros.push({ metodo: 'eq', columna, valor });
      return builder;
    },
    is(columna: string, valor: unknown) {
      consulta.filtros.push({ metodo: 'is', columna, valor });
      return builder;
    },
    order(columna: string, opciones?: { ascending?: boolean }) {
      consulta.orden = { columna, ascending: opciones?.ascending ?? true };
      return builder;
    },
    maybeSingle: async () => normalizar(resolver(consulta)),
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
