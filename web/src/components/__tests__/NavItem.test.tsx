import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Sprout } from 'lucide-react';
import { NavItem } from '../NavItem';
import styles from '../NavItem.module.css';

function renderEn(path: string, props: Parameters<typeof NavItem>[0]) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NavItem {...props} />
    </MemoryRouter>,
  );
}

const PROPS = { to: '/plantaciones', icon: <Sprout />, label: 'Plantaciones' as const };

test('queda activo en la ruta exacta', () => {
  renderEn('/plantaciones', PROPS);
  expect(screen.getByRole('link', { name: 'Plantaciones' }).className).toContain(styles.activo);
});

test('sin activeOnDetail NO se activa en la ruta de detalle', () => {
  renderEn('/plantaciones/plant-1', PROPS);
  expect(screen.getByRole('link', { name: 'Plantaciones' }).className).not.toContain(styles.activo);
});

test('con activeOnDetail se activa también en la ruta de detalle', () => {
  renderEn('/plantaciones/plant-1', { ...PROPS, activeOnDetail: true });
  expect(screen.getByRole('link', { name: 'Plantaciones' }).className).toContain(styles.activo);
});
