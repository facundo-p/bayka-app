import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { KpisArboles } from '../../../queries/dashboardQueries';
import { ResumenPlantacion } from '../ResumenPlantacion';

const KPIS: KpisArboles = {
  totalArboles: 12480,
  arbolesNN: 37,
  especiesUsadas: 9,
  porcentajeConGps: 94,
  porcentajeConFoto: 81,
};

function card(): HTMLElement {
  return screen.getByRole('region', { name: 'Resumen de la plantación' });
}

test('muestra el total, la meta y las tres tasas', () => {
  render(<ResumenPlantacion datos={KPIS} objetivo={20000} />);

  expect(within(card()).getByText('12.480')).toBeInTheDocument();
  expect(within(card()).getByText('de 20.000 · Meta de la temporada')).toBeInTheDocument();
  expect(within(card()).getByText('94%')).toBeInTheDocument();
  expect(within(card()).getByText('81%')).toBeInTheDocument();
  expect(within(card()).getByText('37')).toBeInTheDocument();
});

test('con N/N pendientes avisa que requieren atención', () => {
  render(<ResumenPlantacion datos={KPIS} objetivo={20000} />);

  expect(within(card()).getByText('requieren atención')).toBeInTheDocument();
});

test.each([
  [1, 'requiere atención'],
  [2, 'requieren atención'],
])('el aviso concuerda con %i N/N: "%s"', (arbolesNN, aviso) => {
  render(<ResumenPlantacion datos={{ ...KPIS, arbolesNN }} objetivo={20000} />);

  expect(within(card()).getByText(aviso)).toBeInTheDocument();
});

test('sin N/N el aviso desaparece: cero es un dato más, no una alerta', () => {
  render(<ResumenPlantacion datos={{ ...KPIS, arbolesNN: 0 }} objetivo={20000} />);

  expect(within(card()).queryByText('requieren atención')).not.toBeInTheDocument();
});

test.each([
  ['nulo', null],
  ['0', 0],
])('con objetivo %s avisa que falta la meta en vez de mostrar "de 0"', (_caso, objetivo) => {
  render(<ResumenPlantacion datos={KPIS} objetivo={objetivo} />);

  expect(within(card()).getByText('Meta no definida')).toBeInTheDocument();
  expect(within(card()).queryByText(/Meta de la temporada/)).not.toBeInTheDocument();
});

test('sin alcance no hay chip de parcela ni salida "Ver todos"', () => {
  render(<ResumenPlantacion datos={KPIS} objetivo={20000} />);

  expect(screen.queryByRole('button', { name: 'Ver todos' })).not.toBeInTheDocument();
});

test('con alcance muestra la parcela y "Ver todos" la suelta', async () => {
  const usuario = userEvent.setup();
  const onVerTodos = vi.fn();
  render(
    <ResumenPlantacion
      datos={KPIS}
      objetivo={20000}
      alcance={{ codigo: 'P-04', nombre: 'El Chañar', onVerTodos }}
    />,
  );

  expect(within(card()).getByText('P-04')).toBeInTheDocument();
  expect(within(card()).getByText('El Chañar')).toBeInTheDocument();

  await usuario.click(screen.getByRole('button', { name: 'Ver todos' }));

  expect(onVerTodos).toHaveBeenCalledTimes(1);
});
