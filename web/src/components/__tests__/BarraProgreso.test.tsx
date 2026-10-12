import { render, screen } from '@testing-library/react';
import { BarraProgreso } from '../BarraProgreso';

function relleno(container: HTMLElement): HTMLElement {
  return container.firstElementChild?.firstElementChild as HTMLElement;
}

function ancho(container: HTMLElement): string {
  return relleno(container).style.getPropertyValue('--ancho');
}

test('el relleno ocupa el porcentaje pedido', () => {
  const { container } = render(<BarraProgreso alto="md" porcentaje={40} />);

  expect(ancho(container)).toBe('40%');
});

test('no redondea: la barra sigue a la proporción exacta', () => {
  const { container } = render(<BarraProgreso alto="md" porcentaje={47.5} />);

  expect(ancho(container)).toBe('47.5%');
});

test('lo que pasa de 100 se recorta a la barra llena', () => {
  const { container } = render(<BarraProgreso alto="lg" porcentaje={130} />);

  expect(ancho(container)).toBe('100%');
});

test('un porcentaje negativo deja la barra vacía', () => {
  const { container } = render(<BarraProgreso alto="sm" porcentaje={-5} />);

  expect(ancho(container)).toBe('0%');
});

test('el color por instancia viaja como --color', () => {
  const { container } = render(<BarraProgreso alto="md" porcentaje={60} color="#123456" />);

  expect(relleno(container).style.getPropertyValue('--color')).toBe('#123456');
});

test('sin color propio no declara --color', () => {
  const { container } = render(<BarraProgreso alto="md" porcentaje={60} />);

  expect(relleno(container).style.getPropertyValue('--color')).toBe('');
});

test('con nombre es una barra de progreso con su valor, redondeado y dentro de 0 a 100', () => {
  render(<BarraProgreso alto="md" porcentaje={24.6} nombre="Fotos bajadas" />);
  const barra = screen.getByRole('progressbar', { name: 'Fotos bajadas' });
  expect(barra).toHaveAttribute('aria-valuenow', '25');
  expect(barra).toHaveAttribute('aria-valuemin', '0');
  expect(barra).toHaveAttribute('aria-valuemax', '100');
});

test('sin nombre no se anuncia como barra de progreso', () => {
  render(<BarraProgreso alto="md" porcentaje={60} />);
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});
