import { leerPaginado, TAMANO_PAGINA } from '../leerPaginado';

/** Genera `cantidad` filas {n} para simular un lote de Supabase. */
function lote(cantidad: number): Array<{ n: number }> {
  return Array.from({ length: cantidad }, (_, indice) => ({ n: indice }));
}

test('pagina hasta agotar: acumula varias páginas (sin el tope de 1000)', async () => {
  // Página 0 llena (1000), página 1 llena (1000), página 2 parcial (500) → 2500.
  const tamanos = [TAMANO_PAGINA, TAMANO_PAGINA, 500];
  const rangos: Array<{ desde: number; hasta: number }> = [];
  const filas = await leerPaginado(async (desde, hasta) => {
    rangos.push({ desde, hasta });
    return { data: lote(tamanos[rangos.length - 1] ?? 0), error: null };
  });

  expect(filas).toHaveLength(2 * TAMANO_PAGINA + 500);
  expect(rangos).toEqual([
    { desde: 0, hasta: 999 },
    { desde: 1000, hasta: 1999 },
    { desde: 2000, hasta: 2999 },
  ]);
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
  const error = leerPaginado(async () => ({ data: null, error: { message: 'falló', code: '42703' } }));
  await expect(error).rejects.toMatchObject({ message: 'falló', code: '42703' });
});
