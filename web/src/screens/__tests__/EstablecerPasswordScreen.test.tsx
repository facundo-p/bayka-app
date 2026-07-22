import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import { renderRutasEn } from '../../test/renderConRutas';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

async function abrirConSesion() {
  estadoMock.sesion = { user: { id: 'user-9', email: 'nueva@bayka.org' } };
  renderRutasEn('/establecer-password');
  await screen.findByLabelText('Contraseña nueva');
}

test('sin sesión (link vencido o ya usado) muestra el aviso y no el formulario', async () => {
  renderRutasEn('/establecer-password');

  expect(await screen.findByRole('alert')).toHaveTextContent(/link expiró o ya fue usado/);
  expect(screen.queryByLabelText('Contraseña nueva')).not.toBeInTheDocument();
});

test('valida longitud mínima y coincidencia antes de guardar', async () => {
  const usuario = userEvent.setup();
  await abrirConSesion();

  await usuario.type(screen.getByLabelText('Contraseña nueva'), 'corta');
  await usuario.type(screen.getByLabelText('Repetir contraseña'), 'corta');
  await usuario.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/al menos 8 caracteres/);
  expect(estadoMock.actualizacionesUsuario).toEqual([]);

  await usuario.clear(screen.getByLabelText('Contraseña nueva'));
  await usuario.type(screen.getByLabelText('Contraseña nueva'), 'segura123');
  await usuario.clear(screen.getByLabelText('Repetir contraseña'));
  await usuario.type(screen.getByLabelText('Repetir contraseña'), 'segura124');
  await usuario.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Las contraseñas no coinciden');
  expect(estadoMock.actualizacionesUsuario).toEqual([]);
});

test('guarda la contraseña y muestra el éxito con la nota para técnicos', async () => {
  const usuario = userEvent.setup();
  await abrirConSesion();

  await usuario.type(screen.getByLabelText('Contraseña nueva'), 'segura123');
  await usuario.type(screen.getByLabelText('Repetir contraseña'), 'segura123');
  await usuario.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(/Contraseña lista/),
  );
  expect(estadoMock.actualizacionesUsuario).toEqual([{ password: 'segura123' }]);
  expect(screen.getByText(/ingresá desde la app Bayka/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Ir al ingreso de la web' })).toBeInTheDocument();
});

test('un error al guardar muestra el mensaje genérico y permite reintentar', async () => {
  estadoMock.errorUpdateUser = { message: 'boom' };
  const usuario = userEvent.setup();
  await abrirConSesion();

  await usuario.type(screen.getByLabelText('Contraseña nueva'), 'segura123');
  await usuario.type(screen.getByLabelText('Repetir contraseña'), 'segura123');
  await usuario.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo completar/);
  expect(screen.getByRole('button', { name: 'Guardar contraseña' })).toBeEnabled();
});
