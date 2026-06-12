import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from '../../hooks/useAuth';
import { estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import { LoginScreen } from '../LoginScreen';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>
    </MemoryRouter>,
  );
}

test('muestra el wordmark y el formulario de ingreso', async () => {
  renderLogin();
  expect(screen.getByText('BAYKA')).toBeInTheDocument();
  expect(screen.getByLabelText('Email')).toBeInTheDocument();
  expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeEnabled();
});

test('con credenciales malas muestra el error en pantalla', async () => {
  estadoMock.errorSignIn = { message: 'Invalid login credentials' };
  const usuario = userEvent.setup();
  renderLogin();

  await usuario.type(screen.getByLabelText('Email'), 'ana@bayka.com');
  await usuario.type(screen.getByLabelText('Contraseña'), 'incorrecta');
  await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas');
});
