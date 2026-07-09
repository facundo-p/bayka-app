import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { buscar, type ResultadoBusqueda } from '../../../queries/buscarQueries';
import { useResultadosBusqueda } from '../useResultadosBusqueda';

// La búsqueda combinada se mockea: acá solo interesa el debounce y la carrera
// de respuestas del hook, no la query real (cubierta en buscarQueries.test).
vi.mock('../../../queries/buscarQueries', () => ({ buscar: vi.fn() }));
const buscarMock = vi.mocked(buscar);

/** Promesa controlable a mano para simular respuestas fuera de orden. */
function diferido<T>() {
  let resolver!: (valor: T) => void;
  const promesa = new Promise<T>((res) => {
    resolver = res;
  });
  return { promesa, resolver };
}

const RESULTADO_VIEJO: ResultadoBusqueda[] = [
  { tipo: 'plantacion', id: 'vieja', titulo: 'Vieja', to: '/x' },
];
const RESULTADO_NUEVO: ResultadoBusqueda[] = [
  { tipo: 'plantacion', id: 'nueva', titulo: 'Nueva', to: '/y' },
];

beforeEach(() => {
  vi.useFakeTimers();
  buscarMock.mockReset();
  // Por defecto una promesa que nunca resuelve: evita llamadas inesperadas.
  buscarMock.mockReturnValue(new Promise(() => {}));
});

afterEach(() => vi.useRealTimers());

/** Flush de microtareas (las promesas resueltas) sin tocar el reloj falso. */
async function vaciarMicrotareas() {
  await act(async () => {
    await Promise.resolve();
  });
}

test('aplica debounce: no vuelve a buscar hasta que pasa el retardo', async () => {
  buscarMock.mockResolvedValue([]);
  const { rerender } = renderHook(({ texto }) => useResultadosBusqueda(texto), {
    initialProps: { texto: 'a' },
  });

  // El montaje busca el valor inicial una sola vez.
  await vaciarMicrotareas();
  expect(buscarMock).toHaveBeenCalledTimes(1);

  rerender({ texto: 'ab' });
  // Dentro del retardo: no dispara una nueva búsqueda todavía.
  await act(async () => {
    vi.advanceTimersByTime(100);
  });
  expect(buscarMock).toHaveBeenCalledTimes(1);

  // Cumplido el retardo: busca el texto nuevo.
  await act(async () => {
    vi.advanceTimersByTime(100);
  });
  expect(buscarMock).toHaveBeenCalledTimes(2);
  expect(buscarMock).toHaveBeenLastCalledWith('ab', undefined);
});

test('ignora la respuesta obsoleta cuando el texto ya cambió (race)', async () => {
  const primera = diferido<ResultadoBusqueda[]>();
  const segunda = diferido<ResultadoBusqueda[]>();
  buscarMock.mockReturnValueOnce(primera.promesa).mockReturnValueOnce(segunda.promesa);

  const { result, rerender } = renderHook(({ texto }) => useResultadosBusqueda(texto), {
    initialProps: { texto: 'a' },
  });

  // Montaje → buscar('a') (respuesta lenta, aún pendiente).
  await vaciarMicrotareas();
  expect(buscarMock).toHaveBeenNthCalledWith(1, 'a', undefined);

  // El usuario sigue tipeando antes de que resuelva la primera búsqueda.
  rerender({ texto: 'ab' });
  await act(async () => {
    vi.advanceTimersByTime(200);
  });
  expect(buscarMock).toHaveBeenNthCalledWith(2, 'ab', undefined);

  // Resuelven fuera de orden: primero la obsoleta ('a'), después la vigente ('ab').
  await act(async () => {
    primera.resolver(RESULTADO_VIEJO);
    await primera.promesa;
  });
  // La respuesta obsoleta no debe pisar el estado.
  expect(result.current).toEqual([]);

  await act(async () => {
    segunda.resolver(RESULTADO_NUEVO);
    await segunda.promesa;
  });
  expect(result.current).toEqual(RESULTADO_NUEVO);
});
