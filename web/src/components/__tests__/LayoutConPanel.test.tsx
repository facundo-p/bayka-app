import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { vi } from 'vitest';
import { ANCHO, simularAncho } from '../../test/simularAncho';
import { LayoutConPanel, PanelLateral } from '../PanelLateral';
import { Table, type TableColumn } from '../Table';

interface Fila {
  id: string;
  nombre: string;
}

const FILAS: Fila[] = [
  { id: 'a', nombre: 'Anchico' },
  { id: 'b', nombre: 'Ibirá Pitá' },
];
const COLUMNAS: Array<TableColumn<Fila>> = [{ key: 'nombre', header: 'Nombre' }];

/** Listado con detalle; la selección y lo escrito viven afuera del panel, como en las pantallas. */
function ListadoConDetalle() {
  const [abierta, setAbierta] = useState<Fila | null>(null);
  const [nota, setNota] = useState('');
  const panel = abierta && (
    <PanelLateral
      etiqueta={`Detalle de ${abierta.nombre}`}
      cabecera={<h2>{abierta.nombre}</h2>}
      onCerrar={() => setAbierta(null)}
    >
      <input aria-label="Nota" value={nota} onChange={(evento) => setNota(evento.target.value)} />
    </PanelLateral>
  );
  return (
    <LayoutConPanel panel={panel}>
      <Table
        columns={COLUMNAS}
        rows={FILAS}
        getRowKey={(fila) => fila.id}
        claveSeleccionada={abierta?.id}
        onRowClick={setAbierta}
      />
    </LayoutConPanel>
  );
}

const fila = (nombre: string) => screen.getByText(nombre).closest('tr')!;

async function abrirAnchico() {
  const usuario = userEvent.setup();
  render(<ListadoConDetalle />);
  await usuario.click(screen.getByText('Anchico'));
  return usuario;
}

describe('arriba de 900px', () => {
  test('el detalle es una columna al costado, no un modal', async () => {
    await abrirAnchico();
    expect(screen.getByRole('complementary', { name: 'Detalle de Anchico' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('a 900px o menos', () => {
  beforeEach(() => simularAncho(ANCHO.tablet));

  test('el detalle se abre en una hoja modal, con el título del panel y no otro', async () => {
    await abrirAnchico();
    const hoja = screen.getByRole('dialog', { name: 'Detalle de Anchico' });
    expect(hoja).toHaveFocus();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Anchico' })).toBeInTheDocument();
  });

  test.each([
    ['con Escape', (usuario: ReturnType<typeof userEvent.setup>) => usuario.keyboard('{Escape}')],
    [
      'con la X',
      (usuario: ReturnType<typeof userEvent.setup>) =>
        usuario.click(screen.getByRole('button', { name: 'Cerrar Detalle de Anchico' })),
    ],
    [
      'con un clic en el fondo',
      (usuario: ReturnType<typeof userEvent.setup>) =>
        usuario.click(screen.getByRole('dialog').parentElement!),
    ],
  ])('cierra %s, deselecciona y devuelve el foco a la fila', async (_como, cerrar) => {
    const usuario = await abrirAnchico();
    await cerrar(usuario);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fila('Anchico')).toHaveFocus();
  });

  test('el Escape lo atiende la hoja: el panel no cierra dos veces', () => {
    const onCerrar = vi.fn();
    render(
      <PanelLateral etiqueta="Detalle" cabecera={<h2>Anchico</h2>} onCerrar={onCerrar}>
        <p>cuerpo</p>
      </PanelLateral>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });
});

test('cruzar los 900px con el detalle abierto conserva la selección y lo escrito', async () => {
  const usuario = await abrirAnchico();
  await usuario.type(screen.getByRole('textbox', { name: 'Nota' }), 'hola');

  act(() => simularAncho(ANCHO.tablet));
  expect(screen.getByRole('dialog', { name: 'Detalle de Anchico' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Nota' })).toHaveValue('hola');

  act(() => simularAncho(ANCHO.desktop));
  expect(screen.getByRole('complementary', { name: 'Detalle de Anchico' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Nota' })).toHaveValue('hola');
});
