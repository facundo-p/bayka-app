import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpeciesDistribution } from '../SpeciesDistribution';

const ESPECIES = [
  { codigo: 'QB', nombre: 'Quebracho', cantidad: 3, color: '#1a1a1a' },
  { codigo: 'AL', nombre: 'Algarrobo', cantidad: 0, color: '#2b2b2b' },
];

function renderPanel(especieSeleccionada: string | null = null, onSeleccionar = vi.fn()) {
  render(
    <SpeciesDistribution
      especies={ESPECIES}
      total={3}
      totalEspecies={1}
      especieSeleccionada={especieSeleccionada}
      onSeleccionar={onSeleccionar}
    />,
  );
  return onSeleccionar;
}

test.each([
  [0, '0', 'especies'],
  [1, '1', 'especie'],
  [2, '2', 'especies'],
  [1000, '1.000', 'especies'],
])('el conteo de %i especies se lee "%s %s"', (totalEspecies, numero, etiqueta) => {
  render(
    <SpeciesDistribution
      especies={[]}
      total={0}
      totalEspecies={totalEspecies}
      especieSeleccionada={null}
      onSeleccionar={vi.fn()}
    />,
  );

  expect(screen.getByText(etiqueta).parentElement).toHaveTextContent(`${numero}${etiqueta}`);
});

test('cada fila es un botón que marca la especie elegida', () => {
  renderPanel('AL');

  expect(screen.getByRole('button', { name: /Algarrobo/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: /Quebracho/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('click, Enter y Espacio eligen la especie por su código', async () => {
  const usuario = userEvent.setup();
  const onSeleccionar = renderPanel();
  const fila = screen.getByRole('button', { name: /Quebracho/ });

  await usuario.click(fila);
  fila.focus();
  await usuario.keyboard('{Enter}');
  await usuario.keyboard(' ');

  expect(onSeleccionar.mock.calls).toEqual([['QB'], ['QB'], ['QB']]);
});

test('una especie elegida sin árboles se muestra en 0, sin romper las barras', () => {
  render(
    <SpeciesDistribution
      especies={[ESPECIES[1]]}
      total={0}
      totalEspecies={0}
      especieSeleccionada="AL"
      onSeleccionar={vi.fn()}
    />,
  );

  expect(screen.getByRole('button', { name: /Algarrobo/ })).toHaveTextContent('0%');
});
