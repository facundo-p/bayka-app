import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { TabNav } from '../TabNav';
import styles from '../TabNav.module.css';

const TABS = [
  { to: '/plantaciones/1', label: 'Dashboard', end: true },
  { to: '/plantaciones/1/datos', label: 'Datos' },
];

function renderTabs(ruta: string) {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <TabNav tabs={TABS} label="Secciones" />
    </MemoryRouter>,
  );
}

test('marca activa la tab de la ruta actual', () => {
  renderTabs('/plantaciones/1/datos');

  expect(screen.getByRole('link', { name: 'Datos' }).className).toContain(styles.tabActiva);
  expect(screen.getByRole('link', { name: 'Dashboard' }).className).not.toContain(styles.tabActiva);
});

test('la tab index se marca en su ruta exacta y la navegación tiene nombre', () => {
  renderTabs('/plantaciones/1');

  expect(screen.getByRole('navigation', { name: 'Secciones' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Dashboard' }).className).toContain(styles.tabActiva);
  expect(screen.getByRole('link', { name: 'Datos' }).className).not.toContain(styles.tabActiva);
});
