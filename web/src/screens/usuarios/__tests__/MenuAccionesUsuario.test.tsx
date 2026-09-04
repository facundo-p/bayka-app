import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ItemMenu } from '../acciones';
import { MenuAccionesUsuario } from '../MenuAccionesUsuario';

const ITEMS: ItemMenu[] = [
  { accion: 'editar', etiqueta: 'Editar', motivo: null },
  {
    accion: 'desactivar',
    etiqueta: 'Desactivar',
    motivo: 'Un superadmin no puede desactivarse a sí mismo',
    destructiva: true,
  },
];

function renderMenu(items: ItemMenu[] = ITEMS) {
  const onAccion = vi.fn();
  render(<MenuAccionesUsuario nombre="Ana" items={items} onAccion={onAccion} />);
  return onAccion;
}

test('el disparador tiene el aria-label con el nombre y el menú arranca cerrado', () => {
  renderMenu();
  expect(screen.getByRole('button', { name: 'Acciones de Ana' })).toBeInTheDocument();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test('al hacer click en el disparador muestra un menuitem por cada item', async () => {
  const usuario = userEvent.setup();
  renderMenu();

  await usuario.click(screen.getByRole('button', { name: 'Acciones de Ana' }));

  expect(screen.getByRole('menu')).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: 'Editar' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: 'Desactivar' })).toBeInTheDocument();
});

test('un item con motivo queda deshabilitado y expone el motivo como title', async () => {
  const usuario = userEvent.setup();
  renderMenu();

  await usuario.click(screen.getByRole('button', { name: 'Acciones de Ana' }));

  const itemDesactivar = screen.getByRole('menuitem', { name: 'Desactivar' });
  expect(itemDesactivar).toBeDisabled();
  expect(itemDesactivar).toHaveAttribute('title', 'Un superadmin no puede desactivarse a sí mismo');
});

test('clickear un item habilitado llama a onAccion con la acción y cierra el menú', async () => {
  const usuario = userEvent.setup();
  const onAccion = renderMenu();

  await usuario.click(screen.getByRole('button', { name: 'Acciones de Ana' }));
  await usuario.click(screen.getByRole('menuitem', { name: 'Editar' }));

  expect(onAccion).toHaveBeenCalledWith('editar');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test('presionar Escape cierra el menú', async () => {
  const usuario = userEvent.setup();
  renderMenu();

  await usuario.click(screen.getByRole('button', { name: 'Acciones de Ana' }));
  expect(screen.getByRole('menu')).toBeInTheDocument();

  await usuario.keyboard('{Escape}');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test('clickear afuera cierra el menú', async () => {
  const usuario = userEvent.setup();
  renderMenu();

  await usuario.click(screen.getByRole('button', { name: 'Acciones de Ana' }));
  expect(screen.getByRole('menu')).toBeInTheDocument();

  await usuario.click(document.body);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
