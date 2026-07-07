import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Breadcrumb } from '../Breadcrumb';
import styles from '../Breadcrumb.module.css';

function renderConRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

test('los items con to son enlaces y el último es texto plano current', () => {
  renderConRouter(
    <Breadcrumb
      items={[
        { label: 'Plantaciones', to: '/plantaciones' },
        { label: 'Otoño 2026 — La Maluka' },
      ]}
    />,
  );
  const enlace = screen.getByRole('link', { name: 'Plantaciones' });
  expect(enlace).toHaveAttribute('href', '/plantaciones');
  const actual = screen.getByText('Otoño 2026 — La Maluka');
  expect(actual.className).toContain(styles.current);
  expect(actual).toHaveAttribute('aria-current', 'page');
});

test('el último item nunca se renderiza como link aunque tenga to', () => {
  renderConRouter(
    <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Final', to: '/final' }]} />,
  );
  expect(screen.queryByRole('link', { name: 'Final' })).not.toBeInTheDocument();
  expect(screen.getByText('Final').className).toContain(styles.current);
});
