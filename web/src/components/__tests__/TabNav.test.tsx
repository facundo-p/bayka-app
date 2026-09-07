import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { TabNav } from '../TabNav';
import styles from '../TabNav.module.css';

const TABS = [
  { to: '/plantaciones/1', label: 'Dashboard', end: true },
  { to: '/plantaciones/1/datos', label: 'Datos' },
];

function renderTabs(ruta: string, variant?: 'principal' | 'secundaria' | 'segmentada') {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <TabNav tabs={TABS} label="Secciones" variant={variant} />
    </MemoryRouter>,
  );
}

test('marca activa la tab de la ruta actual', () => {
  renderTabs('/plantaciones/1/datos');

  expect(screen.getByRole('link', { name: 'Datos' }).className).toContain(styles.tabActiva);
  expect(screen.getByRole('link', { name: 'Dashboard' }).className).not.toContain(styles.tabActiva);
});

test('la variante segmentada es la misma navegación con piel de píldora', () => {
  renderTabs('/plantaciones/1', 'segmentada');

  expect(screen.getByRole('navigation', { name: 'Secciones' }).className).toContain(
    styles.navSegmentada,
  );
  expect(screen.getByRole('link', { name: 'Dashboard' }).className).toContain(styles.tabActiva);
});
