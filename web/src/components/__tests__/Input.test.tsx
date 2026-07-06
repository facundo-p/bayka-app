import { render, screen } from '@testing-library/react';
import { Input } from '../Input';

test('asocia el label al input y muestra el hint', () => {
  render(<Input label="Nombre" hint="Como figura en el título" />);
  expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
  expect(screen.getByText('Como figura en el título')).toBeInTheDocument();
});

test('con error muestra el mensaje, marca aria-invalid y oculta el hint', () => {
  render(<Input label="Nombre" hint="ayuda" error="Requerido" />);
  expect(screen.getByLabelText('Nombre')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('alert')).toHaveTextContent('Requerido');
  expect(screen.queryByText('ayuda')).not.toBeInTheDocument();
});
