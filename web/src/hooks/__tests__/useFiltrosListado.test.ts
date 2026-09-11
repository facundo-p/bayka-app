import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { DEMORA_BUSQUEDA_MS } from '../useBusquedaDemorada';
import { useFiltrosListado } from '../useFiltrosListado';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

type Fila = { nombre: string; activa: boolean };
type Filtros = { soloActivas: boolean };

const FILAS: Fila[] = [
  { nombre: 'Norte', activa: true },
  { nombre: 'Sur', activa: false },
];

function filtrar(filas: Fila[], { busqueda, soloActivas }: Filtros & { busqueda: string }) {
  return filas.filter(
    (fila) => fila.nombre.toLowerCase().includes(busqueda) && (!soloActivas || fila.activa),
  );
}

function nombres(filas: Fila[]) {
  return filas.map((fila) => fila.nombre);
}

test('sin datos todavía no hay filas visibles', () => {
  const { result } = renderHook(() =>
    useFiltrosListado(undefined, filtrar, { soloActivas: false }),
  );
  expect(result.current.visibles).toEqual([]);
});

test('filtra con los valores iniciales y expone los controles de la barra', () => {
  const { result } = renderHook(() => useFiltrosListado(FILAS, filtrar, { soloActivas: true }));
  expect(nombres(result.current.visibles)).toEqual(['Norte']);
  expect(result.current.controles.filtros).toEqual({ soloActivas: true });
  expect(result.current.controles.busqueda).toBe('');
});

test('cambiar un filtro vuelve a filtrar sin tocar los demás', () => {
  const { result } = renderHook(() => useFiltrosListado(FILAS, filtrar, { soloActivas: true }));

  act(() => result.current.controles.onFiltro('soloActivas', false));

  expect(nombres(result.current.visibles)).toEqual(['Norte', 'Sur']);
});

test('la búsqueda filtra recién después de la demora', () => {
  const { result } = renderHook(() => useFiltrosListado(FILAS, filtrar, { soloActivas: false }));

  act(() => result.current.controles.onBuscar('sur'));
  expect(result.current.controles.busqueda).toBe('sur');
  expect(nombres(result.current.visibles)).toEqual(['Norte', 'Sur']);

  act(() => vi.advanceTimersByTime(DEMORA_BUSQUEDA_MS));
  expect(nombres(result.current.visibles)).toEqual(['Sur']);
});
