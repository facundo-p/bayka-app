import { leerPaginado, PAGINAS_EN_PARALELO, TAMANO_PAGINA } from '../leerPaginado';

/** Genera `cantidad` filas {n} para simular un lote de Supabase. */
function lote(cantidad: number): Array<{ n: number }> {
  return Array.from({ length: cantidad }, (_, indice) => ({ n: indice }));
}

/** Simula una tabla de `total` filas: cada rango devuelve su tramo, como PostgREST. */
function tabla(total: number) {
  const rangos: Array<{ desde: number; hasta: number }> = [];
  const consultar = async (desde: number, hasta: number) => {
    rangos.push({ desde, hasta });
    const cantidad = Math.max(0, Math.min(hasta, total - 1) - desde + 1);
    return { data: lote(cantidad).map(({ n }) => ({ n: desde + n })), error: null };
  };
  return { rangos, consultar };
}

test('pagina hasta agotar: acumula varias páginas (sin el tope de 1000)', async () => {
  const { rangos, consultar } = tabla(2 * TAMANO_PAGINA + 500);
  const filas = await leerPaginado(consultar);

  expect(filas).toHaveLength(2 * TAMANO_PAGINA + 500);
  expect(filas.map(({ n }) => n)).toEqual(lote(2 * TAMANO_PAGINA + 500).map(({ n }) => n));
  // La primera sola; después una tanda de PAGINAS_EN_PARALELO.
  expect(rangos).toHaveLength(1 + PAGINAS_EN_PARALELO);
  expect(rangos.slice(0, 3)).toEqual([
    { desde: 0, hasta: 999 },
    { desde: 1000, hasta: 1999 },
    { desde: 2000, hasta: 2999 },
  ]);
});

test('pide las páginas de una tanda a la vez y las arma en orden aunque lleguen desordenadas', async () => {
  const total = 3 * TAMANO_PAGINA + 10;
  let enVuelo = 0;
  let maximoEnVuelo = 0;
  const filas = await leerPaginado(async (desde, hasta) => {
    enVuelo += 1;
    maximoEnVuelo = Math.max(maximoEnVuelo, enVuelo);
    // Las páginas más tempranas tardan más: llegan al revés.
    await new Promise((resolver) => setTimeout(resolver, 10 - desde / TAMANO_PAGINA));
    enVuelo -= 1;
    const cantidad = Math.max(0, Math.min(hasta, total - 1) - desde + 1);
    return { data: lote(cantidad).map(({ n }) => ({ n: desde + n })), error: null };
  });

  expect(maximoEnVuelo).toBe(PAGINAS_EN_PARALELO);
  expect(filas.map(({ n }) => n)).toEqual(lote(total).map(({ n }) => n));
});

test('una sola página parcial corta sin pedir más', async () => {
  let llamadas = 0;
  const filas = await leerPaginado(async () => {
    llamadas += 1;
    return { data: lote(10), error: null };
  });
  expect(filas).toHaveLength(10);
  expect(llamadas).toBe(1);
});

test('propaga el error preservando el code de Postgres', async () => {
  const error = leerPaginado(async () => ({
    data: null,
    error: { message: 'falló', code: '42703' },
  }));
  await expect(error).rejects.toMatchObject({ message: 'falló', code: '42703' });
});
