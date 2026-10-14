import { renderHook } from '@testing-library/react';
import type { ParcelaConStats } from '../../../queries/dataExplorerQueries';
import { useSoltarParcelaFantasma } from '../useSoltarParcelaFantasma';

const NORTE: ParcelaConStats = {
  id: 'p1',
  nombre: 'Norte',
  codigo: 'N',
  descripcion: null,
  createdAt: '2026-01-01',
  grupos: 1,
  arboles: 3,
};

function renderSoltar(parcelas: ParcelaConStats[], parcelaId: string) {
  const soltar = vi.fn();
  renderHook(() => useSoltarParcelaFantasma(parcelas, parcelaId, soltar));
  return soltar;
}

test('con las parcelas sin cargar no suelta nada: todavía no se sabe si existe', () => {
  expect(renderSoltar([], 'p9')).not.toHaveBeenCalled();
});

test('una parcela que existe se conserva', () => {
  expect(renderSoltar([NORTE], 'p1')).not.toHaveBeenCalled();
});

test('una parcela que no existe se suelta a "todas"', () => {
  expect(renderSoltar([NORTE], 'p9')).toHaveBeenCalledWith('');
});
