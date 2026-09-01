import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from '../PasswordInput';

test('arranca oculta y el ojito alterna a texto visible y de vuelta', async () => {
  const usuario = userEvent.setup();
  render(<PasswordInput label="Contraseña" />);
  const campo = screen.getByLabelText('Contraseña');
  await usuario.type(campo, 'secreta123');

  expect(campo).toHaveAttribute('type', 'password');

  await usuario.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
  expect(campo).toHaveAttribute('type', 'text');
  expect(campo).toHaveValue('secreta123');

  await usuario.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
  expect(campo).toHaveAttribute('type', 'password');
});

test('el ojito expone su estado con aria-pressed', async () => {
  const usuario = userEvent.setup();
  render(<PasswordInput label="Contraseña" />);

  const ojito = screen.getByRole('button', { name: 'Mostrar contraseña' });
  expect(ojito).toHaveAttribute('aria-pressed', 'false');

  await usuario.click(ojito);
  expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('dentro de un form el ojito no dispara el submit', async () => {
  const alEnviar = vi.fn((evento: React.FormEvent) => evento.preventDefault());
  const usuario = userEvent.setup();
  render(
    <form onSubmit={alEnviar}>
      <PasswordInput label="Contraseña" />
    </form>,
  );

  await usuario.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
  expect(alEnviar).not.toHaveBeenCalled();
});

test('con error muestra el mensaje y marca aria-invalid, como Input', () => {
  render(<PasswordInput label="Contraseña" hint="ayuda" error="Requerido" />);
  expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('alert')).toHaveTextContent('Requerido');
  expect(screen.queryByText('ayuda')).not.toBeInTheDocument();
});
