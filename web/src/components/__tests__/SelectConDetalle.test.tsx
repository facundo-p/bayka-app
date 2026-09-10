import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../Modal';
import { SelectConDetalle } from '../SelectConDetalle';
import type { OpcionConDetalle } from '../opcionesConDetalle';

const OPCIONES: OpcionConDetalle[] = [
  { valor: 'u4', principal: 'Lucía Ferreyra', secundario: 'lucia@bayka.app' },
  { valor: 'u7', principal: 'Lucía Ferreyra', secundario: 'lferreyra@gmail.com' },
  { valor: 'u8', principal: 'Pablo Ríos', secundario: null },
];

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

async function abrir(usuario: Usuario) {
  await usuario.click(disparador());
  return screen.getByRole('listbox', { name: 'Técnico' });
}

test('cerrado muestra el placeholder; abierto lista nombre y email y enfoca el buscador', async () => {
  const usuario = userEvent.setup();
  render(<EnModal />);
  expect(disparador()).toHaveAccessibleName('Técnico Elegí un técnico');
  expect(disparador()).toHaveAttribute('aria-expanded', 'false');

  const lista = await abrir(usuario);

  expect(disparador()).toHaveAttribute('aria-expanded', 'true');
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

test('el buscador filtra por email y por nombre sin acentos', async () => {
  const usuario = userEvent.setup();
  render(<EnModal />);
  const lista = await abrir(usuario);

  await usuario.type(buscador(), 'gmail');
  expect(within(lista).getAllByRole('option')).toHaveLength(1);
  expect(within(lista).getByRole('option', { name: /lferreyra@gmail.com/ })).toBeInTheDocument();

  await usuario.clear(buscador());
  await usuario.type(buscador(), 'rios');
  expect(within(lista).getByRole('option', { name: 'Pablo Ríos' })).toBeInTheDocument();
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
  const [primera, segunda] = within(lista).getAllByRole('option');
  expect(buscador()).toHaveAttribute('aria-activedescendant', primera.id);
  expect(primera).toHaveAttribute('aria-selected', 'true');

  await usuario.keyboard('{ArrowDown}');
  expect(buscador()).toHaveAttribute('aria-activedescendant', segunda.id);

  await usuario.keyboard('{Enter}');
  expect(disparador()).toHaveAccessibleName('Técnico Lucía Ferreyra lferreyra@gmail.com');
});

test('al reabrir, resalta la opción elegida', async () => {
  const usuario = userEvent.setup();
  render(<EnModal />);
  await usuario.click(within(await abrir(usuario)).getByRole('option', { name: 'Pablo Ríos' }));

  const lista = await abrir(usuario);

  expect(within(lista).getByRole('option', { name: 'Pablo Ríos' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('Escape cierra solo la lista, no el modal', async () => {
  const usuario = userEvent.setup();
  const onCerrarModal = vi.fn();
  render(<EnModal onCerrarModal={onCerrarModal} />);
  await abrir(usuario);

  await usuario.keyboard('{Escape}');

  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(onCerrarModal).not.toHaveBeenCalled();
  expect(disparador()).toHaveFocus();
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
