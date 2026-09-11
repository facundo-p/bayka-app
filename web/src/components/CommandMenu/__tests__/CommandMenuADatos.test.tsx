import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PERFIL_SUPERADMIN, prepararSesion } from '../../../test/supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from '../../../test/queryBuilderMock';
import { capturarConsultas } from '../../../test/capturarConsultas';
import { renderRutasEn } from '../../../test/renderConRutas';

vi.mock('../../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../../test/supabaseMock');
  return { supabase: supabaseMock };
});

/** Del resultado a la tabla: monta el detalle y la sección antes de llegar a la fila. */
const ESPERA_RUTA_MS = 5000;

const FILA_PLANTACION = {
  id: 'plant-1',
  lugar: 'La Maluka',
  periodo: 'Otoño 2026',
  estado: 'activa',
  created_at: '2026-04-01T00:00:00Z',
  visible_in_app: true,
};

/** Cada fila lleva las columnas de la búsqueda y las del listado de su sección:
 *  el mock responde lo mismo a las dos consultas. */
const FILA_PARCELA = {
  id: 'parc-1',
  nombre: 'Norte',
  codigo: 'P1',
  descripcion: null,
  created_at: '2026-04-01T00:00:00Z',
  plantation_id: 'plant-1',
  plantations: { lugar: 'La Maluka' },
};

const FILA_GRUPO = {
  id: 'gr-1',
  nombre: 'Línea 1',
  codigo: 'L1',
  tipo: 'linea',
  estado: 'activa',
  parcela_id: 'parc-1',
  plantation_id: 'plant-1',
  created_at: '2026-04-01T00:00:00Z',
  parcelas: { codigo: 'P1' },
};

const FILA_ARBOL = {
  id: 'tree-1',
  sub_id: 'PAL23ANC12',
  posicion: 1,
  group_id: 'gr-1',
  species_id: null,
  species: null,
  foto_url: null,
  usuario_registro: null,
  created_at: '2026-04-02T00:00:00Z',
  latitude: null,
  longitude: null,
  gps_accuracy: null,
  gps_captured_at: null,
  groups: { codigo: 'L1', parcela_id: 'parc-1', plantation_id: 'plant-1' },
};

let consultas: ConsultaCapturada[];

/** El detalle filtra por id con maybeSingle → devolver la fila única. */
function resolverPlantations(consulta: ConsultaCapturada): RespuestaMock {
  const porId = consulta.filtros.some((filtro) => filtro.metodo === 'eq' && filtro.columna === 'id');
  return porId ? { data: FILA_PLANTACION } : { data: [FILA_PLANTACION], count: 1 };
}

function resolverTrees(consulta: ConsultaCapturada): RespuestaMock {
  if (consulta.opciones?.head) return { count: 1 };
  if (consulta.columnas?.startsWith('group_id')) return { data: [{ group_id: FILA_GRUPO.id }] };
  return { data: [FILA_ARBOL], count: 1 };
}

function responder(consulta: ConsultaCapturada): RespuestaMock {
  switch (consulta.tabla) {
    case 'plantations':
      return resolverPlantations(consulta);
    case 'parcelas':
      return { data: [FILA_PARCELA] };
    case 'groups':
      return consulta.opciones?.head ? { count: 1 } : { data: [FILA_GRUPO] };
    case 'trees':
      return resolverTrees(consulta);
    default:
      return { data: [], count: 0 };
  }
}

beforeEach(() => {
  prepararSesion(PERFIL_SUPERADMIN);
  consultas = capturarConsultas(responder);
  window.localStorage.clear();
});

/** Abre la paleta desde el listado, busca y elige el resultado. */
async function elegirResultado(texto: string, resultado: RegExp) {
  renderRutasEn('/plantaciones');
  await screen.findAllByText(FILA_PLANTACION.lugar);
  fireEvent.keyDown(document, { key: 'k', metaKey: true });
  const dialog = await screen.findByRole('dialog', { name: 'Buscar' });
  const usuario = userEvent.setup();
  await usuario.type(within(dialog).getByPlaceholderText(/Buscar plantaciones/), texto);
  await usuario.click(await within(dialog).findByRole('option', { name: resultado }));
}

async function esperarFila(celda: string) {
  return screen.findByRole('cell', { name: celda }, { timeout: ESPERA_RUTA_MS });
}

test.each([
  { tipo: 'parcela', texto: 'Norte', resultado: /P1 · Norte/, seccion: 'Parcelas', celda: 'Norte' },
  { tipo: 'grupo', texto: 'Línea', resultado: /L1 · Línea 1/, seccion: 'Grupos', celda: 'Línea 1' },
])('un resultado de $tipo abre la sección $seccion de Datos', async (caso) => {
  await elegirResultado(caso.texto, caso.resultado);

  expect(await esperarFila(caso.celda)).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: caso.seccion })).toHaveAttribute('aria-checked', 'true');
});

test('un resultado de árbol abre Árboles con su SubID en el buscador', async () => {
  await elegirResultado('PAL23', /PAL23ANC12/);

  expect(await esperarFila('PAL23ANC12')).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Árboles' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByLabelText('Buscar por ID o SubID')).toHaveValue('PAL23ANC12');
  const listado = consultas.filter(
    (consulta) => consulta.tabla === 'trees' && Boolean(consulta.columnas?.startsWith('*')),
  );
  expect(listado.at(-1)?.filtros).toContainEqual(
    expect.objectContaining({ metodo: 'ilike', columna: 'sub_id', valor: expect.stringMatching(/PAL23ANC12/i) }),
  );
});
