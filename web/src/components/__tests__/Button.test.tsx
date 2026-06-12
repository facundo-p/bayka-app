import { render, screen } from '@testing-library/react';
import { Button } from '../Button';
import styles from '../Button.module.css';

test('aplica primary por defecto y la variante pedida', () => {
  render(<Button>Guardar</Button>);
  expect(screen.getByRole('button', { name: 'Guardar' }).className).toContain(styles.primary);
});

test('loading deshabilita el botón y muestra el spinner', () => {
  render(
    <Button variant="danger" loading>
      Eliminar
    </Button>,
  );
  const button = screen.getByRole('button', { name: /Eliminar/ });
  expect(button.className).toContain(styles.danger);
  expect(button).toBeDisabled();
  expect(screen.getByRole('status')).toBeInTheDocument();
});
