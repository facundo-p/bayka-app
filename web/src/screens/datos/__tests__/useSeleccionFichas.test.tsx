import { act, renderHook } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { useSeleccionFichas } from '../useSeleccionFichas';
import { descargarFichasPdf } from '../../../services/pdfFichas';
import { plantacion } from '../../../test/fabricas';

vi.mock('../../../services/pdfFichas', () => ({ descargarFichasPdf: vi.fn() }));

const CONTEXTO = {
  plantacion: plantacion(),
  nombresUsuario: new Map<string, string>(),
  queryClient: new QueryClient(),
};

function renderSeleccion(idsPagina: string[], clave = 'p#1') {
  return renderHook(({ ids, clavePagina }) => useSeleccionFichas(clavePagina, ids, CONTEXTO), {
    initialProps: { ids: idsPagina, clavePagina: clave },
  });
}

test('un id que no está en la página no se guarda, ni aparece si después llega', () => {
  const { result, rerender } = renderSeleccion([]);
  act(() => result.current.alternar('a'));
  rerender({ ids: ['a', 'b'], clavePagina: 'p#1' });
  expect(result.current.ids).toEqual([]);
  expect(result.current.estaMarcado('a')).toBe(false);
});

test('un refetch que saca un id marcado lo deja fuera del recuento y del PDF', async () => {
  const { result, rerender } = renderSeleccion(['a', 'b', 'c']);
  act(() => result.current.alternar('a'));
  act(() => result.current.alternar('c'));
  rerender({ ids: ['b', 'c'], clavePagina: 'p#1' });

  expect(result.current.ids).toEqual(['c']);
  expect(result.current.maestro).toBe('parcial');
  await result.current.generar?.();
  expect(descargarFichasPdf).toHaveBeenCalledWith(['c'], CONTEXTO);
});

test('el pedido de foco va a la franja al entrar, al botón «PDF» al cancelar, y se baja al tomarlo', () => {
  const { result } = renderSeleccion(['a']);
  expect(result.current.focoEnFranja).toBe(false);
  expect(result.current.focoEnSeleccionar).toBe(false);

  act(() => result.current.entrar());
  expect(result.current.focoEnFranja).toBe(true);
  act(() => result.current.focoTomado());
  expect(result.current.focoEnFranja).toBe(false);

  act(() => result.current.cancelar());
  expect(result.current.focoEnSeleccionar).toBe(true);
  act(() => result.current.focoTomado());
  expect(result.current.focoEnSeleccionar).toBe(false);
});
