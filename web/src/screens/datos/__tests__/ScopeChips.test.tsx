import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Cargando } from '../../../components';
import { ScopeChips } from '../ScopeChips';

test('ScopeChips no renderiza nada sin chips', () => {
  const { container } = render(<ScopeChips chips={[]} />);
  expect(container).toBeEmptyDOMElement();
});

test('ScopeChips muestra la etiqueta y dispara onQuitar al cerrar', () => {
  const onQuitar = vi.fn();
  render(<ScopeChips chips={[{ etiqueta: 'Parcela A-01', onQuitar }]} />);
  expect(screen.getByText('Parcela A-01')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Quitar Parcela A-01' }));
  expect(onQuitar).toHaveBeenCalledTimes(1);
});

test('Cargando muestra la etiqueta opcional bajo el spinner', () => {
  render(<Cargando label="Cargando árboles…" />);
  expect(screen.getByText('Cargando árboles…')).toBeInTheDocument();
  expect(screen.getByRole('status')).toBeInTheDocument();
});
