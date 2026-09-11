import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EstadoConsulta, type ConsultaListado, type TextosConsulta } from '../EstadoConsulta';

const TEXTOS: TextosConsulta = {
  error: 'No se pudieron cargar las especies.',
  vacio: { titulo: 'Sin especies', descripcion: 'El catálogo va a aparecer acá.' },
};

const LISTADO = 'tabla de especies';

function renderEstado(parcial: Partial<ConsultaListado>) {
  const consulta: ConsultaListado = {
    data: undefined,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    ...parcial,
  };
  render(
    <EstadoConsulta consulta={consulta} textos={TEXTOS}>
      {LISTADO}
    </EstadoConsulta>,
  );
  return consulta;
}

test('mientras carga: spinner, sin listado ni error', () => {
  renderEstado({ isPending: true });
  expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
  expect(screen.queryByText(LISTADO)).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('error sin datos: el mensaje con un reintento que vuelve a pedir', async () => {
  const consulta = renderEstado({ isError: true });

  expect(screen.getByRole('alert')).toHaveTextContent(TEXTOS.error);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(consulta.refetch).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(LISTADO)).not.toBeInTheDocument();
});

test('error con datos previos: sigue el listado y no hay cartel de error', () => {
  renderEstado({ isError: true, data: [{ id: 1 }] });
  expect(screen.getByText(LISTADO)).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('vacío total: el estado vacío en lugar del listado', () => {
  renderEstado({ data: [] });
  expect(screen.getByText(TEXTOS.vacio.titulo)).toBeInTheDocument();
  expect(screen.getByText(TEXTOS.vacio.descripcion)).toBeInTheDocument();
  expect(screen.queryByText(LISTADO)).not.toBeInTheDocument();
});

test('con filas: el listado', () => {
  renderEstado({ data: [{ id: 1 }] });
  expect(screen.getByText(LISTADO)).toBeInTheDocument();
  expect(screen.queryByText(TEXTOS.vacio.titulo)).not.toBeInTheDocument();
});
