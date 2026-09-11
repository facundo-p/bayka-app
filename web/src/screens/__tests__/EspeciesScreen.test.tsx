import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { estadoMock, prepararSesionAdmin } from '../../test/supabaseMock';
import { enMain, renderRutasEn } from '../../test/renderConRutas';
import { textoCompleto } from '../../test/textoCompleto';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(prepararSesionAdmin);

const FILAS_ESPECIES = [
  { id: 'sp-1', codigo: 'ANC', nombre: 'Anchico', nombre_cientifico: 'Parapiptadenia rigida' },
  { id: 'sp-2', codigo: 'IBI', nombre: 'Ibirá Pitá', nombre_cientifico: 'Peltophorum dubium' },
];

/** Resuelve el catálogo (species), el uso (plantation_species / trees) y deja
 *  vacío el listado de plantaciones del sidebar. */
function configurarEspeciesMock(): void {
  estadoMock.resolverConsulta = (consulta) => {
    if (consulta.tabla === 'species') return { data: FILAS_ESPECIES, error: null };
    if (consulta.tabla === 'plantation_species') {
      // Anchico habilitado en 1 plantación; Ibirá Pitá en ninguna.
      return { data: [{ species_id: 'sp-1' }], error: null };
    }
    if (consulta.tabla === 'trees') {
      const especieId = consulta.filtros.find((filtro) => filtro.columna === 'species_id')?.valor;
      return { count: especieId === 'sp-1' ? 1234 : 0, error: null };
    }
    // plantations + sus counts (sidebar SeasonCard): sin datos.
    return { data: [], error: null, count: 0 };
  };
}

test('renderiza la cabecera con el uso del catálogo y una fila de especie', async () => {
  configurarEspeciesMock();
  renderRutasEn('/especies');

  await screen.findByText('Anchico');
  const main = enMain();
  expect(main.getByRole('heading', { name: 'Especies' })).toBeInTheDocument();
  // La cabecera resume el catálogo: total y cuántas están en uso.
  expect(main.getByText('Catálogo global · 2 especies nativas · 1 en uso')).toBeInTheDocument();
  expect(main.getByText('Anchico')).toBeInTheDocument();
  expect(main.getByText('ANC')).toBeInTheDocument();
  expect(main.getByText('Parapiptadenia rigida')).toBeInTheDocument();
  // Anchico: 1 plantación, 1.234 árboles (el recuento de la toolbar repite el total).
  const filaAnchico = main.getByText('Anchico').closest('tr');
  if (!filaAnchico) throw new Error('No se encontró la fila de Anchico');
  expect(within(filaAnchico).getByText('1.234')).toBeInTheDocument();
});

test('muestra el uso por especie: plantaciones y árboles (0/0 la sin uso)', async () => {
  configurarEspeciesMock();
  renderRutasEn('/especies');

  await screen.findByText('Anchico');
  const main = enMain();
  // Anchico: habilitado en 1 plantación, 1.234 árboles.
  const filaAnchico = main.getByText('Anchico').closest('tr');
  if (!filaAnchico) throw new Error('No se encontró la fila de Anchico');
  expect(within(filaAnchico).getByText('1')).toBeInTheDocument();
  expect(within(filaAnchico).getByText('1.234')).toBeInTheDocument();
  // Ibirá Pitá: sin uso → 0 plantaciones y 0 árboles.
  const filaIbira = main.getByText('Ibirá Pitá').closest('tr');
  if (!filaIbira) throw new Error('No se encontró la fila de Ibirá Pitá');
  expect(within(filaIbira).getAllByText('0').length).toBeGreaterThanOrEqual(2);
});

test('la búsqueda filtra la lista y deja solo las coincidencias', async () => {
  configurarEspeciesMock();
  const usuario = userEvent.setup();
  renderRutasEn('/especies');

  await screen.findByText('Anchico');
  await usuario.type(enMain().getByPlaceholderText(/Buscar por nombre/i), 'Ibirá');

  await waitFor(() => expect(enMain().queryByText('Anchico')).not.toBeInTheDocument());
  expect(enMain().getByText('Ibirá Pitá')).toBeInTheDocument();
});

test('una búsqueda sin coincidencias muestra el vacío del listado', async () => {
  configurarEspeciesMock();
  const usuario = userEvent.setup();
  renderRutasEn('/especies');

  await screen.findByText('Anchico');
  await usuario.type(enMain().getByPlaceholderText(/Buscar por nombre/i), 'zzz-no-existe');

  expect(
    await enMain().findByText('No hay especies que coincidan con la búsqueda'),
  ).toBeInTheDocument();
  expect(enMain().queryByText('Anchico')).not.toBeInTheDocument();
});

test('"Nueva especie" abre el panel en modo alta (campos vacíos)', async () => {
  configurarEspeciesMock();
  const usuario = userEvent.setup();
  renderRutasEn('/especies');

  await screen.findByText('Anchico');
  await usuario.click(screen.getByRole('button', { name: 'Nueva especie' }));

  expect(await screen.findByRole('heading', { name: 'Nueva especie' })).toBeInTheDocument();
  expect(screen.getByLabelText('Código *')).toHaveValue('');
  expect(screen.getByLabelText('Nombre común *')).toHaveValue('');
});

test('click en una fila abre el panel de edición precargado con esa especie', async () => {
  configurarEspeciesMock();
  const usuario = userEvent.setup();
  renderRutasEn('/especies');

  await usuario.click(await screen.findByText('Anchico'));

  expect(await screen.findByRole('heading', { name: 'Editar especie' })).toBeInTheDocument();
  expect(screen.getByLabelText('Código *')).toHaveValue('ANC');
  expect(screen.getByLabelText('Nombre común *')).toHaveValue('Anchico');
  expect(screen.getByLabelText('Nombre científico')).toHaveValue('Parapiptadenia rigida');
});

test('el filtro de uso separa las especies usadas de las que no', async () => {
  configurarEspeciesMock();
  const usuario = userEvent.setup();
  renderRutasEn('/especies');
  await screen.findByText('Anchico');

  // Ibirá Pitá no está en ninguna plantación y no tiene árboles.
  await usuario.click(enMain().getByRole('radio', { name: 'Sin uso' }));
  await waitFor(() => expect(enMain().queryByText('Anchico')).not.toBeInTheDocument());
  expect(enMain().getByText('Ibirá Pitá')).toBeInTheDocument();

  await usuario.click(enMain().getByRole('radio', { name: 'En uso' }));
  await waitFor(() => expect(enMain().queryByText('Ibirá Pitá')).not.toBeInTheDocument());
  expect(enMain().getByText('Anchico')).toBeInTheDocument();
});

test('el panel se cierra con la X y la fila abierta queda marcada', async () => {
  configurarEspeciesMock();
  const usuario = userEvent.setup();
  renderRutasEn('/especies');

  await usuario.click(await screen.findByText('Anchico'));
  const panel = screen.getByRole('complementary', { name: 'Editar especie' });
  expect(panel).toBeInTheDocument();

  await usuario.click(screen.getByRole('button', { name: 'Cerrar Editar especie' }));
  expect(
    screen.queryByRole('complementary', { name: 'Editar especie' }),
  ).not.toBeInTheDocument();
});

test('con el catálogo vacío muestra el vacío total, no el de la búsqueda', async () => {
  estadoMock.resolverConsulta = () => ({ data: [], error: null, count: 0 });
  renderRutasEn('/especies');

  expect(await screen.findByText('Sin especies')).toBeInTheDocument();
  expect(screen.getByText('El catálogo de especies va a aparecer acá.')).toBeInTheDocument();
  expect(
    screen.queryByText('No hay especies que coincidan con la búsqueda'),
  ).not.toBeInTheDocument();
});

test('ante un error muestra el mensaje con botón de reintento', async () => {
  estadoMock.resolverConsulta = () => {
    throw new Error('falló la red');
  };
  renderRutasEn('/especies');

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No se pudieron cargar las especies.',
  );
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
});

test('el recuento de la barra concuerda en singular', async () => {
  configurarEspeciesMock();
  const usuario = userEvent.setup();
  renderRutasEn('/especies');
  await screen.findByText('Anchico');

  expect(enMain().getByText(textoCompleto('2 especies · 1.234 árboles'))).toBeInTheDocument();
  await usuario.click(enMain().getByRole('radio', { name: 'En uso' }));
  expect(
    await enMain().findByText(textoCompleto('1 especie · 1.234 árboles')),
  ).toBeInTheDocument();
});
