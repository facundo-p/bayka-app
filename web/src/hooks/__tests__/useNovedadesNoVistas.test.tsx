import { render, screen, act } from '@testing-library/react';
import { marcarNovedadesVistas, useNovedadesNoVistas } from '../useNovedadesNoVistas';

vi.mock('../../lib/entorno', () => ({ VERSION_APP: 'v9.9.9' }));

const CLAVE = 'bayka.novedades.ultima-vista';

function Sonda({ nombre }: { nombre: string }) {
  const hay = useNovedadesNoVistas();
  return <span data-testid={nombre}>{hay ? 'si' : 'no'}</span>;
}

beforeEach(() => window.localStorage.clear());

test('primera visita (sin clave) cuenta como novedades sin ver', () => {
  render(<Sonda nombre="a" />);
  expect(screen.getByTestId('a')).toHaveTextContent('si');
});

test('con la versión actual ya marcada, no hay novedades', () => {
  window.localStorage.setItem(CLAVE, 'v9.9.9');
  render(<Sonda nombre="a" />);
  expect(screen.getByTestId('a')).toHaveTextContent('no');
});

test('una versión vieja marcada vuelve a encender el aviso', () => {
  window.localStorage.setItem(CLAVE, 'v1.0.0');
  render(<Sonda nombre="a" />);
  expect(screen.getByTestId('a')).toHaveTextContent('si');
});

test('marcar vistas persiste la versión y apaga el aviso en todos los montados', () => {
  render(
    <>
      <Sonda nombre="a" />
      <Sonda nombre="b" />
    </>,
  );
  expect(screen.getByTestId('a')).toHaveTextContent('si');

  act(() => marcarNovedadesVistas());

  expect(window.localStorage.getItem(CLAVE)).toBe('v9.9.9');
  expect(screen.getByTestId('a')).toHaveTextContent('no');
  expect(screen.getByTestId('b')).toHaveTextContent('no');
});
