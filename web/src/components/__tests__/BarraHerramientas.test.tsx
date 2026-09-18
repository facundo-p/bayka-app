import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ANCHO, simularAncho } from '../../test/simularAncho';
import { BarraHerramientas, RecuentoItem } from '../BarraHerramientas';

const ARBOL = { singular: 'árbol', plural: 'árboles' };

function renderRecuento(cantidad: number) {
  render(
    <BarraHerramientas
      tituloFiltros="Filtros de prueba"
      filtrosActivos={0}
      recuento={<RecuentoItem cantidad={cantidad} sustantivo={ARBOL} />}
    />,
  );
}

test('RecuentoItem: la cifra formateada y destacada, y el sustantivo en plural', () => {
  renderRecuento(1234);
  expect(screen.getByText('1.234').tagName).toBe('STRONG');
  expect(screen.getByText('1.234').parentElement).toHaveTextContent('1.234 árboles');
});

test.each([
  [0, '0 árboles'],
  [1, '1 árbol'],
  [2, '2 árboles'],
])('RecuentoItem con %i: "%s"', (cantidad, texto) => {
  renderRecuento(cantidad);
  expect(screen.getByText(String(cantidad)).parentElement).toHaveTextContent(texto);
});

function renderBarra(props: { filtrosActivos?: number; onLimpiar?: () => void } = {}) {
  render(
    <BarraHerramientas
      tituloFiltros="Filtros de prueba"
      filtrosActivos={props.filtrosActivos ?? 0}
      onLimpiar={props.onLimpiar}
      encabezado={<input aria-label="Buscar" />}
      recuento={<RecuentoItem cantidad={12} sustantivo={ARBOL} />}
    >
      <button type="button">Solo activas</button>
    </BarraHerramientas>,
  );
}

test('en escritorio los filtros van en la fila y no hay hoja', () => {
  renderBarra();
  expect(screen.getByRole('button', { name: 'Solo activas' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Filtros/ })).not.toBeInTheDocument();
});

test('en teléfono los filtros se guardan detrás de un botón, y el buscador queda', () => {
  simularAncho(ANCHO.movil);
  renderBarra();
  expect(screen.getByLabelText('Buscar')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Solo activas' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Filtros' })).toBeInTheDocument();
  // El recuento deja de ocupar un renglón propio.
  expect(screen.queryByText('12')).not.toBeInTheDocument();
});

test('la hoja muestra los filtros y el recuento en su botón de cierre', async () => {
  simularAncho(ANCHO.movil);
  renderBarra();
  const usuario = userEvent.setup();

  await usuario.click(screen.getByRole('button', { name: 'Filtros' }));
  const hoja = screen.getByRole('dialog', { name: 'Filtros de prueba' });
  expect(within(hoja).getByRole('button', { name: 'Solo activas' })).toBeInTheDocument();

  const ver = within(hoja).getByRole('button', { name: 'Ver 12 árboles' });
  await usuario.click(ver);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('el botón muestra cuántos filtros están puestos', () => {
  simularAncho(ANCHO.movil);
  renderBarra({ filtrosActivos: 2 });
  expect(screen.getByRole('button', { name: 'Filtros 2' })).toBeInTheDocument();
});

test('limpiar solo se ofrece habilitado cuando hay algo que limpiar', async () => {
  const onLimpiar = vi.fn();
  simularAncho(ANCHO.movil);
  renderBarra({ filtrosActivos: 0, onLimpiar });
  const usuario = userEvent.setup();

  await usuario.click(screen.getByRole('button', { name: 'Filtros' }));
  expect(screen.getByRole('button', { name: 'Limpiar' })).toBeDisabled();
});

test('con filtros puestos, limpiar los devuelve al inicio', async () => {
  const onLimpiar = vi.fn();
  simularAncho(ANCHO.movil);
  renderBarra({ filtrosActivos: 1, onLimpiar });
  const usuario = userEvent.setup();

  await usuario.click(screen.getByRole('button', { name: /Filtros/ }));
  await usuario.click(screen.getByRole('button', { name: 'Limpiar' }));
  expect(onLimpiar).toHaveBeenCalledOnce();
});
