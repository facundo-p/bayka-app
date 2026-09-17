import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../../Modal';
import { SelectConDetalle } from '../SelectConDetalle';
import type { OpcionConDetalle } from '../opcionesConDetalle';
import { OPCIONES } from './fixtures';

/** Dentro de un Modal real: el caso de uso y el conflicto de Escape que importa. */
function EnModal({
  opciones = OPCIONES,
  onCerrarModal = vi.fn(),
}: {
  opciones?: OpcionConDetalle[];
  onCerrarModal?: () => void;
}) {
  const [valor, setValor] = useState('');
  return (
    <Modal open title="Asignar técnico" onClose={onCerrarModal}>
      <SelectConDetalle
        label="Técnico"
        value={valor}
        onChange={setValor}
        opciones={opciones}
        placeholder="Elegí un técnico"
        placeholderBusqueda="Buscar por nombre o email"
        textoVacio="No quedan técnicos para asignar."
        textoSinCoincidencias="Ningún técnico coincide."
      />
    </Modal>
  );
}

type Usuario = ReturnType<typeof userEvent.setup>;

const disparador = () => screen.getByRole('button', { name: /^Técnico/ });
const buscador = () => screen.getByRole('combobox', { name: 'Buscar por nombre o email' });
const resaltada = () => screen.getByRole('option', { selected: true });

async function abrir(usuario: Usuario) {
  await usuario.click(disparador());
  return screen.getByRole('listbox', { name: 'Técnico' });
}

/** La opción resaltada es la que anuncia el buscador. */
function esperarResaltada(nombre: string | RegExp) {
  expect(resaltada()).toHaveAccessibleName(nombre);
  expect(buscador()).toHaveAttribute('aria-activedescendant', resaltada().id);
}

test('cerrado muestra el placeholder; abierto lista nombre y email y enfoca el buscador', async () => {
  const usuario = userEvent.setup();
  render(<EnModal />);
  expect(disparador()).toHaveAccessibleName('Técnico Elegí un técnico');
  expect(disparador()).toHaveAttribute('aria-expanded', 'false');

  const lista = await abrir(usuario);

  expect(disparador()).toHaveAttribute('aria-expanded', 'true');
  expect(disparador()).toHaveAttribute('aria-controls', lista.id);
  expect(buscador()).toHaveFocus();
  const nombres = within(lista)
    .getAllByRole('option')
    .map((opcion) => opcion.textContent);
  expect(nombres).toEqual([
    'Lucía Ferreyra lucia@bayka.app',
    'Lucía Ferreyra lferreyra@gmail.com',
    'Pablo Ríos',
  ]);
});

test('el buscador filtra por email', async () => {
  const usuario = userEvent.setup();
  render(<EnModal />);
  const lista = await abrir(usuario);

  await usuario.type(buscador(), 'gmail');

  expect(within(lista).getAllByRole('option')).toHaveLength(1);
  expect(within(lista).getByRole('option', { name: /lferreyra@gmail.com/ })).toBeInTheDocument();
});

test('avisa cuando la búsqueda no coincide y cuando no hay opciones', async () => {
  const usuario = userEvent.setup();
  const { unmount } = render(<EnModal />);
  await abrir(usuario);
  await usuario.type(buscador(), 'zzz');
  expect(screen.getByText('Ningún técnico coincide.')).toBeInTheDocument();
  unmount();

  render(<EnModal opciones={[]} />);
  await abrir(usuario);
  expect(screen.getByText('No quedan técnicos para asignar.')).toBeInTheDocument();
});

test('elegir con el mouse cierra, muestra nombre y email en el disparador y le devuelve el foco', async () => {
  const usuario = userEvent.setup();
  render(<EnModal />);
  const lista = await abrir(usuario);

  await usuario.click(within(lista).getByRole('option', { name: /lferreyra@gmail.com/ }));

  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(disparador()).toHaveAccessibleName('Técnico Lucía Ferreyra lferreyra@gmail.com');
  expect(disparador()).toHaveFocus();
});

test('con teclado: flecha abre, flechas resaltan y Enter elige', async () => {
  const usuario = userEvent.setup();
  render(<EnModal />);
  disparador().focus();

  await usuario.keyboard('{ArrowDown}');
  const lista = screen.getByRole('listbox');
  expect(buscador()).toHaveAttribute('aria-controls', lista.id);
  expect(buscador()).toHaveAttribute('aria-autocomplete', 'list');
  esperarResaltada('Lucía Ferreyra lucia@bayka.app');

  await usuario.keyboard('{ArrowDown}');
  esperarResaltada('Lucía Ferreyra lferreyra@gmail.com');

  await usuario.keyboard('{Enter}');
  expect(disparador()).toHaveAccessibleName('Técnico Lucía Ferreyra lferreyra@gmail.com');
});

test('ArrowUp da la vuelta desde la primera; Home y End van a los extremos', async () => {
  const usuario = userEvent.setup();
  render(<EnModal />);
  await abrir(usuario);

  await usuario.keyboard('{ArrowUp}');
  esperarResaltada('Pablo Ríos');
  await usuario.keyboard('{Home}');
  esperarResaltada('Lucía Ferreyra lucia@bayka.app');
  await usuario.keyboard('{End}');
  esperarResaltada('Pablo Ríos');
});

test('al reabrir, resalta la opción elegida', async () => {
  const usuario = userEvent.setup();
  render(<EnModal />);
  await usuario.click(within(await abrir(usuario)).getByRole('option', { name: 'Pablo Ríos' }));

  await abrir(usuario);

  esperarResaltada('Pablo Ríos');
});

test('si la opción resaltada desaparece al filtrar, se resalta la primera que queda', async () => {
  const usuario = userEvent.setup();
  render(<EnModal />);
  await abrir(usuario);
  await usuario.keyboard('{End}');

  await usuario.type(buscador(), 'lucia');

  esperarResaltada('Lucía Ferreyra lucia@bayka.app');
  await usuario.keyboard('{Enter}');
  expect(disparador()).toHaveAccessibleName('Técnico Lucía Ferreyra lucia@bayka.app');
});

test('con la lista vacía tras filtrar no hay opción activa y Enter no elige', async () => {
  const usuario = userEvent.setup();
  render(<EnModal />);
  const lista = await abrir(usuario);

  await usuario.type(buscador(), 'zzz');
  await usuario.keyboard('{Enter}');

  expect(within(lista).queryAllByRole('option')).toHaveLength(0);
  expect(buscador()).not.toHaveAttribute('aria-activedescendant');
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  expect(disparador()).toHaveAccessibleName('Técnico Elegí un técnico');
});

test('Escape cierra solo la lista; un segundo Escape cierra el modal', async () => {
  const usuario = userEvent.setup();
  const onCerrarModal = vi.fn();
  render(<EnModal onCerrarModal={onCerrarModal} />);
  await abrir(usuario);

  await usuario.keyboard('{Escape}');

  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(onCerrarModal).not.toHaveBeenCalled();
  expect(disparador()).toHaveFocus();

  await usuario.keyboard('{Escape}');
  expect(onCerrarModal).toHaveBeenCalledTimes(1);
});

test('un click adentro del popover, que está en un portal, no lo cierra', async () => {
  const usuario = userEvent.setup();
  render(<EnModal />);
  await abrir(usuario);

  await usuario.click(buscador());
  await usuario.type(buscador(), 'zzz');
  await usuario.click(screen.getByText('Ningún técnico coincide.'));

  expect(screen.getByRole('listbox')).toBeInTheDocument();
});

test('un click afuera cierra la lista sin elegir', async () => {
  const usuario = userEvent.setup();
  render(<EnModal />);
  await abrir(usuario);

  await usuario.click(screen.getByRole('heading', { name: 'Asignar técnico' }));

  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(disparador()).toHaveAccessibleName('Técnico Elegí un técnico');
});

test('un click en el disparador abierto lo cierra', async () => {
  const usuario = userEvent.setup();
  render(<EnModal />);
  await abrir(usuario);

  await usuario.click(disparador());

  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
