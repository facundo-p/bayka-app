import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ParcelasStrip } from '../ParcelasStrip';

const PARCELAS = [
  { id: 'p1', codigo: 'P-01', nombre: 'Lote Norte', arboles: 1240, grupos: 3 },
  { id: 'p2', codigo: 'P-02', nombre: 'Bajo del Sauce', arboles: 1112, grupos: 8 },
];

function renderStrip(seleccionada: string | null, onSeleccionar = vi.fn(), parcelas = PARCELAS) {
  render(
    <MemoryRouter>
      <ParcelasStrip
        parcelas={parcelas}
        parcelaSeleccionada={seleccionada}
        onSeleccionar={onSeleccionar}
      />
    </MemoryRouter>,
  );
  return onSeleccionar;
}

test('lista las parcelas con su recuento y la invitación a filtrar', () => {
  renderStrip(null);

  expect(screen.getByText('2 · clic para filtrar')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Lote Norte/ })).toBeInTheDocument();
  expect(screen.getByText('1.240')).toBeInTheDocument();
});

test.each([
  [0, '0 grupos'],
  [1, '1 grupo'],
  [2, '2 grupos'],
  [1000, '1.000 grupos'],
])('la mini card concuerda los grupos: %i → "%s"', (grupos, texto) => {
  renderStrip(null, vi.fn(), [{ ...PARCELAS[0], grupos }]);

  expect(screen.getByText(texto)).toBeInTheDocument();
});

test('clickear una parcela la propaga y la seleccionada queda marcada', async () => {
  const usuario = userEvent.setup();
  const onSeleccionar = renderStrip('p1');

  expect(screen.getByRole('button', { name: /Lote Norte/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await usuario.click(screen.getByRole('button', { name: /Bajo del Sauce/ }));

  expect(onSeleccionar).toHaveBeenCalledWith('p2');
});

test('las flechas desplazan el riel casi una pantalla en cada sentido', async () => {
  const usuario = userEvent.setup();
  renderStrip(null);
  // jsdom no hace layout: fijamos el ancho visible y espiamos el scroll.
  const riel = screen.getByRole('button', { name: /Lote Norte/ }).parentElement as HTMLElement;
  Object.defineProperty(riel, 'clientWidth', { value: 500, configurable: true });
  const scrollBy = vi.fn();
  riel.scrollBy = scrollBy;

  await usuario.click(screen.getByRole('button', { name: 'Parcelas siguientes' }));
  expect(scrollBy).toHaveBeenCalledWith({ left: 400, behavior: 'smooth' });

  await usuario.click(screen.getByRole('button', { name: 'Parcelas anteriores' }));
  expect(scrollBy).toHaveBeenLastCalledWith({ left: -400, behavior: 'smooth' });
});
