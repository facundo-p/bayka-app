import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { abrirFiltros } from '../../test/panelFiltros';
import { ANCHO, simularAncho } from '../../test/simularAncho';
import { BarraHerramientas, RecuentoItem } from '../BarraHerramientas';

const ARBOL = { singular: 'árbol', plural: 'árboles' };

function renderRecuento(cantidad: number) {
  render(
    <BarraHerramientas
      tituloFiltros="Filtros de prueba"
      filtrosActivos={0}
      recuento={<RecuentoItem cantidad={cantidad} sustantivo={ARBOL} />}
    />,
  );
}

test('RecuentoItem: la cifra formateada y destacada, y el sustantivo en plural', () => {
  renderRecuento(1234);
  expect(screen.getByText('1.234').tagName).toBe('STRONG');
  expect(screen.getByText('1.234').parentElement).toHaveTextContent('1.234 árboles');
});

test.each([
  [0, '0 árboles'],
  [1, '1 árbol'],
  [2, '2 árboles'],
])('RecuentoItem con %i: "%s"', (cantidad, texto) => {
  renderRecuento(cantidad);
  expect(screen.getByText(String(cantidad)).parentElement).toHaveTextContent(texto);
});

interface PropsBarra {
  filtrosActivos?: number;
  onLimpiar?: () => void;
  orden?: React.ReactNode;
}

function renderBarra(props: PropsBarra = {}) {
  render(
    <BarraHerramientas
      tituloFiltros="Filtros de prueba"
      filtrosActivos={props.filtrosActivos ?? 0}
      onLimpiar={props.onLimpiar}
      encabezado={<input aria-label="Buscar" />}
      orden={props.orden}
      recuento={<RecuentoItem cantidad={12} sustantivo={ARBOL} />}
    >
      <button type="button">Solo activas</button>
    </BarraHerramientas>,
  );
}

const ORDEN = <select aria-label="Ordenar" />;

test('en escritorio los filtros van a un panel detrás de un botón; buscador y recuento quedan', async () => {
  renderBarra();
  expect(screen.getByLabelText('Buscar')).toBeInTheDocument();
  expect(screen.getByText('12')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Solo activas' })).not.toBeInTheDocument();

  const panel = await abrirFiltros(userEvent.setup());
  expect(panel.getByRole('button', { name: 'Solo activas' })).toBeInTheDocument();
});

test('el pie del panel limpia los filtros y repite el recuento', async () => {
  const onLimpiar = vi.fn();
  renderBarra({ filtrosActivos: 1, onLimpiar });
  const usuario = userEvent.setup();

  const panel = await abrirFiltros(usuario);
  expect(panel.getByText('12').parentElement).toHaveTextContent('12 árboles');
  await usuario.click(panel.getByRole('button', { name: 'Limpiar' }));
  expect(onLimpiar).toHaveBeenCalledOnce();
});

describe('orden', () => {
  test('en escritorio queda a la vista, fuera del panel', async () => {
    renderBarra({ orden: ORDEN });
    expect(screen.getByLabelText('Ordenar')).toBeInTheDocument();
    const panel = await abrirFiltros(userEvent.setup());
    expect(panel.queryByLabelText('Ordenar')).not.toBeInTheDocument();
  });

  test('en teléfono va a la hoja, después de los filtros', async () => {
    simularAncho(ANCHO.movil);
    renderBarra({ orden: ORDEN });
    expect(screen.queryByLabelText('Ordenar')).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Filtros' }));
    const hoja = within(screen.getByRole('dialog', { name: 'Filtros de prueba' }));
    const filtro = hoja.getByRole('button', { name: 'Solo activas' });
    const orden = hoja.getByLabelText('Ordenar');
    expect(filtro.compareDocumentPosition(orden) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('busqueda, cuando el encabezado es otra cosa', () => {
  function renderConBusqueda(filtros?: React.ReactNode) {
    render(
      <BarraHerramientas
        tituloFiltros="Filtros de prueba"
        filtrosActivos={0}
        encabezado={<button type="button">Sección</button>}
        busqueda={<input aria-label="Buscar" />}
      >
        {filtros}
      </BarraHerramientas>,
    );
  }

  test('en escritorio queda a la vista; sin filtros no hay botón', () => {
    renderConBusqueda();
    expect(screen.getByLabelText('Buscar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Filtros/ })).not.toBeInTheDocument();
  });

  test('en teléfono va a la hoja con los filtros, y la fila queda en el encabezado', async () => {
    simularAncho(ANCHO.movil);
    renderConBusqueda(<input aria-label="Filtro" />);
    expect(screen.getByRole('button', { name: 'Sección' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Buscar')).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Filtros' }));
    const hoja = screen.getByRole('dialog', { name: 'Filtros de prueba' });
    expect(within(hoja).getByLabelText('Buscar')).toBeInTheDocument();
    expect(within(hoja).getByLabelText('Filtro')).toBeInTheDocument();
  });

  test('en teléfono el botón está aunque la búsqueda sea lo único que hay', () => {
    simularAncho(ANCHO.movil);
    renderConBusqueda();
    expect(screen.getByRole('button', { name: 'Filtros' })).toBeInTheDocument();
  });
});

test('en teléfono los filtros se guardan detrás de un botón, y el buscador queda', () => {
  simularAncho(ANCHO.movil);
  renderBarra();
  expect(screen.getByLabelText('Buscar')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Solo activas' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Filtros' })).toBeInTheDocument();
  // El recuento deja de ocupar un renglón propio.
  expect(screen.queryByText('12')).not.toBeInTheDocument();
});

test('la hoja muestra los filtros y el recuento en su botón de cierre', async () => {
  simularAncho(ANCHO.movil);
  renderBarra();
  const usuario = userEvent.setup();

  await usuario.click(screen.getByRole('button', { name: 'Filtros' }));
  const hoja = screen.getByRole('dialog', { name: 'Filtros de prueba' });
  expect(within(hoja).getByRole('button', { name: 'Solo activas' })).toBeInTheDocument();

  const ver = within(hoja).getByRole('button', { name: 'Ver 12 árboles' });
  await usuario.click(ver);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('el botón muestra cuántos filtros están puestos', () => {
  simularAncho(ANCHO.movil);
  renderBarra({ filtrosActivos: 2 });
  expect(screen.getByRole('button', { name: 'Filtros 2' })).toBeInTheDocument();
});

test('limpiar solo se ofrece habilitado cuando hay algo que limpiar', async () => {
  const onLimpiar = vi.fn();
  simularAncho(ANCHO.movil);
  renderBarra({ filtrosActivos: 0, onLimpiar });
  const usuario = userEvent.setup();

  await usuario.click(screen.getByRole('button', { name: 'Filtros' }));
  expect(screen.getByRole('button', { name: 'Limpiar' })).toBeDisabled();
});

test('con filtros puestos, limpiar los devuelve al inicio', async () => {
  const onLimpiar = vi.fn();
  simularAncho(ANCHO.movil);
  renderBarra({ filtrosActivos: 1, onLimpiar });
  const usuario = userEvent.setup();

  await usuario.click(screen.getByRole('button', { name: /Filtros/ }));
  await usuario.click(screen.getByRole('button', { name: 'Limpiar' }));
  expect(onLimpiar).toHaveBeenCalledOnce();
});

describe('acciones', () => {
  function renderConAcciones(acciones: React.ReactNode) {
    return render(
      <BarraHerramientas tituloFiltros="Filtros de prueba" filtrosActivos={0} acciones={acciones}>
        <input aria-label="Filtro" />
      </BarraHerramientas>,
    );
  }
  const accion = <button type="button">Seleccionar</button>;

  test('en escritorio van en la fila y no al panel', async () => {
    renderConAcciones(accion);
    expect(screen.getByRole('button', { name: 'Seleccionar' })).toBeInTheDocument();
    const panel = await abrirFiltros(userEvent.setup());
    expect(panel.queryByRole('button', { name: 'Seleccionar' })).not.toBeInTheDocument();
  });

  test('en teléfono quedan en la fila y no van a la hoja de filtros', async () => {
    simularAncho(ANCHO.movil);
    renderConAcciones(accion);
    expect(screen.getByRole('button', { name: 'Seleccionar' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Filtros' }));
    const hoja = screen.getByRole('dialog', { name: 'Filtros de prueba' });
    expect(within(hoja).queryByRole('button', { name: 'Seleccionar' })).not.toBeInTheDocument();
  });

  test('con acciones={false} no se dibujan y el panel abierto no se remonta', async () => {
    const { rerender } = renderConAcciones(accion);
    const panel = await abrirFiltros(userEvent.setup());
    const filtro = panel.getByLabelText('Filtro');
    rerender(
      <BarraHerramientas tituloFiltros="Filtros de prueba" filtrosActivos={0} acciones={false}>
        <input aria-label="Filtro" />
      </BarraHerramientas>,
    );
    expect(screen.queryByRole('button', { name: 'Seleccionar' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Filtro')).toBe(filtro);
  });
});
