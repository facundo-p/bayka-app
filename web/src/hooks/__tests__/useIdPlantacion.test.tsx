import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router';
import { PATRON_DETALLE_PLANTACION, RUTA, TAB_DETALLE } from '../../lib/rutas';
import { useIdPlantacion } from '../useIdPlantacion';

/** Rutas con la misma forma que las de `App`: el listado y el detalle con tabs. */
function enUrl(url: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path={RUTA.plantaciones} element={children} />
        <Route path={PATRON_DETALLE_PLANTACION} element={<Outlet />}>
          <Route index element={children} />
          <Route path={`${TAB_DETALLE.datos}/*`} element={children} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

test('en el detalle devuelve el id de la ruta', () => {
  const { result } = renderHook(useIdPlantacion, { wrapper: enUrl('/plantaciones/p1') });

  expect(result.current).toBe('p1');
});

test('desde una tab anidada lee el id del detalle', () => {
  const { result } = renderHook(useIdPlantacion, {
    wrapper: enUrl('/plantaciones/p2/datos/arboles'),
  });

  expect(result.current).toBe('p2');
});

test('sin id en la ruta devuelve cadena vacía', () => {
  const { result } = renderHook(useIdPlantacion, { wrapper: enUrl('/plantaciones') });

  expect(result.current).toBe('');
});
