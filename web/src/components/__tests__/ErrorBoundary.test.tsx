import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from '../ErrorBoundary';

const MENSAJE = 'No se pudo mostrar este panel.';

/** Tira mientras `romper` esté prendido: React reintenta el render una vez antes
 *  de avisar al boundary, así que un contador de intentos no sirve. */
let romper = true;

function Fragil() {
  if (romper) throw new Error('dato inesperado');
  return <p>Contenido sano</p>;
}

beforeEach(() => {
  romper = true;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

test('sin error renderiza los hijos tal cual', () => {
  render(
    <ErrorBoundary mensaje={MENSAJE}>
      <p>Contenido sano</p>
    </ErrorBoundary>,
  );
  expect(screen.getByText('Contenido sano')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('un hijo que tira al renderizar muestra el fallback y loguea el error', () => {
  render(
    <ErrorBoundary mensaje={MENSAJE}>
      <Fragil />
    </ErrorBoundary>,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(MENSAJE);
  expect(console.error).toHaveBeenCalledWith(
    'Error al renderizar:',
    expect.any(Error),
    expect.any(String),
  );
});

test('"Reintentar" vuelve a montar los hijos', async () => {
  const usuario = userEvent.setup();
  render(
    <ErrorBoundary mensaje={MENSAJE}>
      <Fragil />
    </ErrorBoundary>,
  );
  romper = false;
  await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(screen.getByText('Contenido sano')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
