import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  estadoMock,
  PERFIL_SUPERADMIN,
  prepararSesion,
  prepararSesionAdmin,
} from '../../test/supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import { renderRutasEn } from '../../test/renderConRutas';
import { ANCHO, simularAncho } from '../../test/simularAncho';
import { ERRORES_GENERACION_IDS } from '../../queries/idsQueries';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

/** Mock del serializador XLSX: evita armar un workbook real en jsdom y deja
 *  asertar filas/columnas con las que se lo invoca. */
vi.mock('write-excel-file/browser', () => ({
  default: vi.fn(() => ({ toBlob: () => Promise.resolve(new Blob(['xlsx'])) })),
}));

const FILA_PLANTACION = {
  id: 'plant-1',
  lugar: 'Mendoza',
  periodo: '2025-2026',
  estado: 'activa',
  created_at: '2026-06-12T12:00:00Z',
  visible_in_app: false,
};

const PERFILES = [
  { id: 'user-2', nombre: 'Beto Técnico', rol: 'tecnico', email: 'beto@bayka.org', activo: true },
  { id: 'user-3', nombre: 'Carla Campo', rol: 'admin', email: 'carla@bayka.org', activo: true },
  { id: 'user-4', nombre: 'Dora Surco', rol: 'tecnico', email: 'dora@bayka.org', activo: true },
];

type FilaAsignada = {
  user_id: string;
  rol_en_plantacion: string;
  assigned_at: string;
  profiles: { nombre: string; rol: string } | null;
};

function filaAsignada(userId: string, rolEnPlantacion: string): FilaAsignada {
  const perfil = PERFILES.find((candidato) => candidato.id === userId);
  return {
    user_id: userId,
    rol_en_plantacion: rolEnPlantacion,
    assigned_at: '2026-06-01T12:00:00Z',
    profiles: perfil ? { nombre: perfil.nombre, rol: perfil.rol } : null,
  };
}

/** Estado mutable del mock: el insert/delete lo actualiza como haría la base. */
let asignadas: FilaAsignada[];
let consultas: ConsultaCapturada[];
/** Conteos de árboles para el gate de "Generar IDs" / "Exportar". */
let totalArboles: number;
let conIdArboles: number;
/** Filas que devuelve la query de exportación (select con `plantacion_id`). */
let filasExport: unknown[];
/** `archivada_en` de la plantación; los RPC de archivado lo cambian como la base. */
let archivadaEn: string | null;
/** `estado` de la plantación; `reabrir_plantacion` lo cambia como la base. */
let estadoPlantacion: string;
/** Respuesta de `previsualizar_eliminacion_plantacion`. */
let previewEliminacion: Record<string, unknown>;

const PREVIEW_SIN_DATOS = {
  success: true,
  parcelas: 1,
  grupos: 0,
  arboles: 0,
  arboles_con_foto: 0,
  tiene_datos: false,
  puede: true,
  motivo: null,
};

const PREVIEW_CON_DATOS = {
  ...PREVIEW_SIN_DATOS,
  grupos: 2,
  arboles: 30,
  arboles_con_foto: 4,
  tiene_datos: true,
};

type Usuario = ReturnType<typeof userEvent.setup>;

/** Abre el menú "Exportar" y devuelve uno de sus ítems. */
async function itemExportar(usuario: Usuario, etiqueta: string) {
  await usuario.click(await screen.findByRole('button', { name: 'Exportar' }));
  return screen.getByRole('menuitem', { name: etiqueta });
}

/** Fila cruda del embed de exportación (trees → groups → plantations/…). */
function filaExport(subId: string) {
  return {
    global_id: 1001,
    plantacion_id: 12,
    sub_id: subId,
    species: { nombre: 'Quebracho' },
    groups: {
      nombre: 'Línea 1',
      plantation_id: 'plant-1',
      plantations: { lugar: 'Mendoza', periodo: '2025-2026' },
      parcelas: { nombre: 'Norte' },
    },
  };
}

function resolverPlantationUsers(consulta: ConsultaCapturada): RespuestaMock {
  if (consulta.operacion === 'insert') {
    const payload = consulta.payload as { user_id: string; rol_en_plantacion: string };
    asignadas.push(filaAsignada(payload.user_id, payload.rol_en_plantacion));
    return { data: null };
  }
  if (consulta.operacion === 'delete') {
    const userId = consulta.filtros.find((filtro) => filtro.columna === 'user_id')?.valor;
    asignadas = asignadas.filter((fila) => fila.user_id !== userId);
    return { data: null };
  }
  return { data: asignadas };
}

function configurarDetalleMock(): void {
  estadoMock.resolverConsulta = (consulta) => {
    consultas.push(consulta);
    if (consulta.operacion === 'rpc' && consulta.tabla === 'generate_tree_ids') {
      // El RPC asigna todos los IDs → el gate pasa a "generado" al re-consultar.
      conIdArboles = totalArboles;
      return { data: { success: true, updated: totalArboles, seed: 1001 } };
    }
    if (consulta.operacion === 'rpc' && consulta.tabla === 'plantation_ids_status') {
      return {
        data: [
          {
            total: totalArboles,
            con_id: conIdArboles,
            generados: totalArboles > 0 && totalArboles === conIdArboles,
          },
        ],
      };
    }
    if (consulta.operacion === 'rpc' && consulta.tabla === 'next_global_id_seed') {
      return { data: 1001 };
    }
    if (consulta.operacion === 'rpc' && consulta.tabla === 'previsualizar_eliminacion_plantacion') {
      return { data: previewEliminacion };
    }
    if (consulta.operacion === 'rpc' && consulta.tabla === 'archivar_plantacion') {
      archivadaEn = '2026-09-17T12:00:00Z';
      return { data: { success: true } };
    }
    if (consulta.operacion === 'rpc' && consulta.tabla === 'desarchivar_plantacion') {
      archivadaEn = null;
      return { data: { success: true } };
    }
    if (consulta.operacion === 'rpc' && consulta.tabla === 'reabrir_plantacion') {
      estadoPlantacion = 'activa';
      return { data: { success: true } };
    }
    if (consulta.tabla === 'plantations') {
      const filtroId = consulta.filtros.find((filtro) => filtro.columna === 'id');
      const fila = { ...FILA_PLANTACION, estado: estadoPlantacion, archivada_en: archivadaEn };
      return { data: filtroId?.valor === FILA_PLANTACION.id ? fila : null };
    }
    if (consulta.tabla === 'profiles') return { data: PERFILES };
    if (consulta.tabla === 'plantation_users') return resolverPlantationUsers(consulta);
    if (consulta.tabla === 'trees') {
      // La query de exportación se distingue por seleccionar `plantacion_id`.
      if (consulta.columnas?.includes('plantacion_id')) return { data: filasExport };
      return { data: [], count: 0 };
    }
    return { data: [], count: 0 };
  };
}

beforeEach(() => {
  prepararSesionAdmin();
  asignadas = [filaAsignada('user-2', 'tecnico')];
  consultas = [];
  totalArboles = 0;
  conIdArboles = 0;
  filasExport = [];
  archivadaEn = null;
  estadoPlantacion = 'activa';
  previewEliminacion = PREVIEW_SIN_DATOS;
  configurarDetalleMock();
});

test('muestra encabezado con badges y las tabs navegan entre sub-rutas', async () => {
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones/plant-1');

  expect(await screen.findByRole('heading', { name: 'Mendoza' })).toBeInTheDocument();
  expect(screen.getByText('Activa')).toBeInTheDocument();
  // Línea de metadatos: período + fecha de creación.
  expect(screen.getByText(/2025-2026 · Creada/)).toBeInTheDocument();
  // La tab index (Dashboard) es la activa por defecto: sin árboles muestra el vacío.
  expect(await screen.findByText('Todavía no hay árboles registrados')).toBeInTheDocument();

  await usuario.click(screen.getByRole('link', { name: 'Datos' }));
  // La tab Datos redirige a Parcelas (default); el selector de sección (toolbar
  // única) expone las secciones como radios.
  expect(await screen.findByRole('radio', { name: 'Parcelas' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Árboles' })).toBeInTheDocument();

  await usuario.click(screen.getByRole('link', { name: 'Configuración' }));
  expect(await screen.findByRole('heading', { name: 'Técnicos asignados' })).toBeInTheDocument();
});

test('"Generar IDs" abre el modal, confirma con el seed sugerido y habilita los exports', async () => {
  const usuario = userEvent.setup();
  totalArboles = 5;
  conIdArboles = 3; // set parcial → todavía no generado
  renderRutasEn('/plantaciones/plant-1');

  await usuario.click(await screen.findByRole('button', { name: 'Generar IDs' }));
  const dialogo = await screen.findByRole('dialog', { name: 'Generar IDs' });
  // Advertencia de irreversibilidad y seed sugerido = MAX global + 1.
  expect(dialogo).toHaveTextContent('Esta acción no se puede deshacer.');
  const input = within(dialogo).getByLabelText('ID global inicial');
  await vi.waitFor(() => expect(input).toHaveValue(1001));

  await usuario.click(within(dialogo).getByRole('button', { name: 'Generar' }));

  // Se ejecuta el RPC transaccional con el seed y, tras invalidar el gate,
  // el modal se cierra y las planillas quedan habilitadas en el menú.
  await vi.waitFor(() =>
    expect(screen.queryByRole('button', { name: /Generar IDs/ })).not.toBeInTheDocument(),
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(await itemExportar(usuario, 'Exportar Excel')).toBeEnabled();
  // El dashboard también dispara un RPC (stats): se busca el de generación.
  const rpc = consultas.find(
    (consulta) => consulta.operacion === 'rpc' && consulta.tabla === 'generate_tree_ids',
  );
  expect(rpc?.payload).toEqual({ p_plantation_id: 'plant-1', p_seed: 1001 });
});

test('si otra sesión ya generó (ALREADY_GENERATED) el modal muestra el error', async () => {
  const usuario = userEvent.setup();
  totalArboles = 5;
  conIdArboles = 0;
  const resolverBase = estadoMock.resolverConsulta!;
  estadoMock.resolverConsulta = (consulta) =>
    consulta.operacion === 'rpc' && consulta.tabla === 'generate_tree_ids'
      ? { data: { success: false, error: ERRORES_GENERACION_IDS.YA_GENERADOS } }
      : resolverBase(consulta);
  renderRutasEn('/plantaciones/plant-1');

  await usuario.click(await screen.findByRole('button', { name: 'Generar IDs' }));
  const dialogo = await screen.findByRole('dialog', { name: 'Generar IDs' });
  await vi.waitFor(() =>
    expect(within(dialogo).getByLabelText('ID global inicial')).toHaveValue(1001),
  );
  await usuario.click(within(dialogo).getByRole('button', { name: 'Generar' }));

  expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
    'Los IDs de esta plantación ya fueron generados',
  );
});

test('ofrece las tres descargas (y oculta "Generar IDs") con los IDs generados', async () => {
  const usuario = userEvent.setup();
  totalArboles = 5;
  conIdArboles = 5; // todos con global_id → generado
  renderRutasEn('/plantaciones/plant-1');

  expect(await itemExportar(usuario, 'Descargar KML')).toBeEnabled();
  expect(screen.getByRole('menuitem', { name: 'Exportar Excel' })).toBeEnabled();
  expect(screen.getByRole('menuitem', { name: 'Exportar CSV' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: /Generar IDs/ })).not.toBeInTheDocument();
});

test('sin IDs generados el KML sigue disponible y las planillas explican por qué no', async () => {
  const usuario = userEvent.setup();
  totalArboles = 5;
  conIdArboles = 3; // set parcial → todavía no generado
  renderRutasEn('/plantaciones/plant-1');

  expect(await screen.findByRole('button', { name: 'Generar IDs' })).toBeInTheDocument();
  expect(await itemExportar(usuario, 'Descargar KML')).toBeEnabled();
  const excel = screen.getByRole('menuitem', { name: 'Exportar Excel' });
  expect(excel).toBeDisabled();
  expect(excel).toHaveAttribute(
    'title',
    'Generá los IDs de la plantación para exportar la planilla',
  );
});

test('exportar sin árboles muestra el mensaje en vez de descargar una planilla vacía', async () => {
  const usuario = userEvent.setup();
  totalArboles = 5;
  conIdArboles = 5;
  filasExport = []; // la query de exportación no devuelve filas
  renderRutasEn('/plantaciones/plant-1');

  await usuario.click(await itemExportar(usuario, 'Exportar Excel'));
  expect(
    await screen.findByText('Esta plantación no tiene árboles para exportar.'),
  ).toBeInTheDocument();
});

test('"Exportar CSV" con árboles dispara la descarga del CSV', async () => {
  const usuario = userEvent.setup();
  const crearUrl = vi.fn(() => 'blob:export');
  const revocarUrl = vi.fn();
  vi.stubGlobal('URL', { ...URL, createObjectURL: crearUrl, revokeObjectURL: revocarUrl });
  totalArboles = 5;
  conIdArboles = 5;
  filasExport = [filaExport('A-001'), filaExport('A-002')];
  renderRutasEn('/plantaciones/plant-1');

  await usuario.click(await itemExportar(usuario, 'Exportar CSV'));

  await vi.waitFor(() => expect(crearUrl).toHaveBeenCalledTimes(1));
  expect(revocarUrl).toHaveBeenCalledTimes(1);
  vi.unstubAllGlobals();
});

test('"Exportar Excel" arma el XLSX con las filas y las 9 columnas y lo descarga', async () => {
  const usuario = userEvent.setup();
  const writeXlsxFile = vi.mocked((await import('write-excel-file/browser')).default);
  const crearUrl = vi.fn(() => 'blob:export');
  const revocarUrl = vi.fn();
  vi.stubGlobal('URL', { ...URL, createObjectURL: crearUrl, revokeObjectURL: revocarUrl });
  totalArboles = 5;
  conIdArboles = 5;
  filasExport = [filaExport('A-001'), filaExport('A-002')];
  renderRutasEn('/plantaciones/plant-1');

  await usuario.click(await itemExportar(usuario, 'Exportar Excel'));

  await vi.waitFor(() => expect(crearUrl).toHaveBeenCalledTimes(1));
  expect(revocarUrl).toHaveBeenCalledTimes(1);
  // La firma de la librería es un overload: fijamos la forma "objetos + columnas".
  const [filas, opciones] = writeXlsxFile.mock.calls[0] as unknown as [
    unknown[],
    { columns: unknown[]; sheet: string },
  ];
  expect(filas).toHaveLength(2);
  expect(opciones.columns).toHaveLength(9);
  expect(opciones.sheet).toBe('Plantacion');
  vi.unstubAllGlobals();
});

test('el botón Editar abre el formulario de la plantación con los datos cargados', async () => {
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones/plant-1');
  await screen.findByRole('heading', { name: 'Mendoza' });

  await usuario.click(screen.getByRole('button', { name: /Editar/ }));
  const dialogo = await screen.findByRole('dialog');
  expect(within(dialogo).getByLabelText(/Lugar/)).toHaveValue('Mendoza');
  expect(within(dialogo).getByLabelText(/Período/)).toHaveValue('2025-2026');
});

test('plantación inexistente muestra el estado vacío con link al listado', async () => {
  renderRutasEn('/plantaciones/no-existe');

  expect(await screen.findByText('Plantación no encontrada')).toBeInTheDocument();
  const volver = screen.getByRole('link', { name: /Volver a plantaciones/ });
  expect(volver).toHaveAttribute('href', '/plantaciones');
});

test('asigna un usuario disponible y la lista se actualiza', async () => {
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones/plant-1/configuracion');

  expect(await screen.findByText('Beto Técnico')).toBeInTheDocument();
  // Asignar es un modal disparado por el botón punteado.
  await usuario.click(screen.getByRole('button', { name: /Asignar técnico/ }));
  const dialogo = screen.getByRole('dialog', { name: 'Asignar técnico' });
  // El rol en plantación no se elige: siempre se asigna como técnico.
  expect(within(dialogo).queryByText('Rol en plantación')).not.toBeInTheDocument();
  await usuario.click(within(dialogo).getByRole('button', { name: /^Técnico/ }));
  await usuario.click(screen.getByRole('option', { name: 'Dora Surco dora@bayka.org' }));
  await usuario.click(within(dialogo).getByRole('button', { name: 'Asignar' }));

  expect(await screen.findByText('Dora Surco')).toBeInTheDocument();
  const insercion = consultas.find((consulta) => consulta.operacion === 'insert');
  expect(insercion?.tabla).toBe('plantation_users');
  expect(insercion?.payload).toEqual({
    plantation_id: 'plant-1',
    user_id: 'user-4',
    rol_en_plantacion: 'tecnico',
  });
});

/** Abre el modal de asignar y su lista de técnicos. */
async function abrirListaDeTecnicos(usuario: Usuario) {
  await usuario.click(screen.getByRole('button', { name: /Asignar técnico/ }));
  await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Técnico/ }));
  return screen.getByRole('listbox');
}

test('el selector solo ofrece técnicos sin asignar, con su email', async () => {
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones/plant-1/configuracion');
  await screen.findByText('Beto Técnico');

  const lista = await abrirListaDeTecnicos(usuario);
  expect(
    within(lista).getByRole('option', { name: 'Dora Surco dora@bayka.org' }),
  ).toBeInTheDocument();
  // Beto ya está asignado; Carla es admin, miembro automático de todas las plantaciones.
  expect(within(lista).queryByRole('option', { name: /Beto Técnico/ })).not.toBeInTheDocument();
  expect(within(lista).queryByRole('option', { name: /Carla Campo/ })).not.toBeInTheDocument();
});

test('el selector no ofrece usuarios dados de baja', async () => {
  const resolverBase = estadoMock.resolverConsulta!;
  estadoMock.resolverConsulta = (consulta) =>
    consulta.tabla === 'profiles'
      ? {
          data: [
            {
              id: 'user-4',
              nombre: 'Dora Surco',
              rol: 'tecnico',
              email: 'dora@bayka.org',
              activo: true,
            },
            {
              id: 'user-5',
              nombre: 'Dina Baja',
              rol: 'tecnico',
              email: 'dina@bayka.org',
              activo: false,
            },
          ],
        }
      : resolverBase(consulta);
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones/plant-1/configuracion');
  await screen.findByText('Beto Técnico');

  const lista = await abrirListaDeTecnicos(usuario);
  expect(within(lista).getByRole('option', { name: /Dora Surco/ })).toBeInTheDocument();
  expect(within(lista).queryByRole('option', { name: /Dina Baja/ })).not.toBeInTheDocument();
});

test('quitar pide confirmación, cancela sin borrar y confirma borrando', async () => {
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones/plant-1/configuracion');
  await screen.findByText('Beto Técnico');

  // Cancelar: la fila sigue y no hubo delete.
  await usuario.click(screen.getByRole('button', { name: 'Quitar Beto Técnico' }));
  let dialogo = screen.getByRole('dialog', { name: 'Quitar usuario' });
  expect(dialogo).toHaveTextContent('Beto Técnico dejará de ver esta plantación en la app.');
  expect(dialogo).toHaveTextContent('Sus árboles registrados se conservan.');
  await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(consultas.some((consulta) => consulta.operacion === 'delete')).toBe(false);

  // Confirmar: borra la fila y la lista queda vacía.
  await usuario.click(screen.getByRole('button', { name: 'Quitar Beto Técnico' }));
  dialogo = screen.getByRole('dialog', { name: 'Quitar usuario' });
  await usuario.click(within(dialogo).getByRole('button', { name: 'Quitar' }));

  expect(await screen.findByText(/Sin técnicos asignados/)).toBeInTheDocument();
  const borrado = consultas.find((consulta) => consulta.operacion === 'delete');
  expect(borrado?.tabla).toBe('plantation_users');
  expect(borrado?.filtros).toEqual([
    { metodo: 'eq', columna: 'plantation_id', valor: 'plant-1' },
    { metodo: 'eq', columna: 'user_id', valor: 'user-2' },
  ]);
});

test('a ≤900px las acciones se pliegan en un solo «⋯» sin perder ninguna', async () => {
  simularAncho(ANCHO.tablet);
  const usuario = userEvent.setup();
  totalArboles = 5;
  conIdArboles = 3; // set parcial → "Generar IDs" sigue en juego
  renderRutasEn('/plantaciones/plant-1');

  // Los tres controles sueltos de la barra ancha ya no están sueltos.
  expect(await screen.findByRole('heading', { name: 'Mendoza' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Exportar' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();

  await usuario.click(screen.getByRole('button', { name: 'Acciones de la plantación' }));
  const menu = screen.getByRole('menu', { name: 'Acciones de la plantación' });
  expect(await within(menu).findByRole('menuitem', { name: 'Generar IDs' })).toBeInTheDocument();
  expect(within(menu).getByRole('menuitem', { name: 'Editar plantación' })).toBeInTheDocument();
  expect(within(menu).getByRole('menuitem', { name: 'Descargar KML' })).toBeEnabled();
  // El gate de las planillas viaja con la acción, no con el control que la muestra.
  const excel = within(menu).getByRole('menuitem', { name: 'Exportar Excel' });
  expect(excel).toBeDisabled();
  expect(excel).toHaveAttribute(
    'title',
    'Generá los IDs de la plantación para exportar la planilla',
  );
});

test('plegado, "Editar plantación" abre el mismo formulario que el botón de la barra ancha', async () => {
  simularAncho(ANCHO.movil);
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones/plant-1');
  await screen.findByRole('heading', { name: 'Mendoza' });

  await usuario.click(screen.getByRole('button', { name: 'Acciones de la plantación' }));
  await usuario.click(screen.getByRole('menuitem', { name: 'Editar plantación' }));

  const dialogo = await screen.findByRole('dialog');
  expect(within(dialogo).getByLabelText(/Lugar/)).toHaveValue('Mendoza');
});

test('plegado, "Generar IDs" abre el modal de confirmación', async () => {
  simularAncho(ANCHO.tablet);
  const usuario = userEvent.setup();
  totalArboles = 5;
  conIdArboles = 3;
  renderRutasEn('/plantaciones/plant-1');
  await screen.findByRole('heading', { name: 'Mendoza' });

  await usuario.click(screen.getByRole('button', { name: 'Acciones de la plantación' }));
  await usuario.click(await screen.findByRole('menuitem', { name: 'Generar IDs' }));

  expect(await screen.findByRole('dialog', { name: 'Generar IDs' })).toHaveTextContent(
    'Esta acción no se puede deshacer.',
  );
});

describe('archivado', () => {
  async function abrirMasAcciones(usuario: Usuario) {
    await usuario.click(await screen.findByRole('button', { name: 'Más acciones' }));
    return screen.getByRole('menu', { name: 'Más acciones' });
  }

  test('archivar avisa qué pasa, llama al RPC y deja la plantación en solo lectura', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1');

    const menu = await abrirMasAcciones(usuario);
    await usuario.click(within(menu).getByRole('menuitem', { name: 'Archivar plantación' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Archivar Mendoza' });
    expect(within(dialogo).getByText(/deja de aparecer en los listados/)).toBeInTheDocument();
    expect(
      within(dialogo).getByText(/no los va a poder subir hasta que se desarchive/),
    ).toBeInTheDocument();

    await usuario.click(within(dialogo).getByRole('button', { name: 'Archivar' }));

    expect(await screen.findByText(/Plantación archivada: no aparece/)).toBeInTheDocument();
    const rpc = consultas.find((consulta) => consulta.tabla === 'archivar_plantacion');
    expect(rpc?.payload).toEqual({ p_id: 'plant-1' });
    expect(screen.getByRole('button', { name: 'Editar' })).toBeDisabled();
  });

  test('una archivada muestra badge y aviso, deshabilita Editar y ofrece desarchivar', async () => {
    archivadaEn = '2026-09-01T12:00:00Z';
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1');

    expect(await screen.findByText('Archivada')).toBeInTheDocument();
    expect(screen.getByText(/Plantación archivada: no aparece/)).toBeInTheDocument();
    const editar = screen.getByRole('button', { name: 'Editar' });
    expect(editar).toBeDisabled();
    expect(editar).toHaveAttribute('title', 'Plantación archivada: desarchivala para editarla');
    // Exportar sigue disponible.
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeEnabled();

    const menu = await abrirMasAcciones(usuario);
    await usuario.click(within(menu).getByRole('menuitem', { name: 'Desarchivar plantación' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Desarchivar Mendoza' });
    expect(
      within(dialogo).getByText(/Su estado \(activa o finalizada\) no cambia/),
    ).toBeInTheDocument();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Desarchivar' }));

    await waitFor(() => expect(screen.queryByText('Archivada')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Editar' })).toBeEnabled();
  });

  test('en una archivada la configuración queda deshabilitada', async () => {
    archivadaEn = '2026-09-01T12:00:00Z';
    renderRutasEn('/plantaciones/plant-1/configuracion');

    await screen.findByRole('heading', { name: 'Técnicos asignados' });
    expect(screen.getByRole('group')).toBeDisabled();
  });

  test('plegado, archivar va dentro del mismo «⋯» y Editar lleva el motivo', async () => {
    simularAncho(ANCHO.tablet);
    archivadaEn = '2026-09-01T12:00:00Z';
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1');
    await screen.findByRole('heading', { name: 'Mendoza' });

    await usuario.click(screen.getByRole('button', { name: 'Acciones de la plantación' }));
    const menu = screen.getByRole('menu', { name: 'Acciones de la plantación' });
    expect(within(menu).getByRole('menuitem', { name: 'Editar plantación' })).toBeDisabled();
    expect(within(menu).getByRole('menuitem', { name: 'Desarchivar plantación' })).toBeEnabled();
  });
});

describe('eliminar', () => {
  async function abrirEliminar(usuario: Usuario) {
    await usuario.click(await screen.findByRole('button', { name: 'Más acciones' }));
    const menu = screen.getByRole('menu', { name: 'Más acciones' });
    await usuario.click(within(menu).getByRole('menuitem', { name: 'Eliminar plantación' }));
    return screen.findByRole('dialog', { name: 'Eliminar Mendoza' });
  }

  test('sin datos: confirmación simple, invoca la función y vuelve al listado', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1');

    const dialogo = await abrirEliminar(usuario);
    expect(await within(dialogo).findByText(/no tiene grupos ni árboles/)).toBeInTheDocument();
    expect(within(dialogo).queryByRole('textbox')).not.toBeInTheDocument();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    expect(await within(dialogo).findByText('La plantación se eliminó.')).toBeInTheDocument();
    expect(estadoMock.invocaciones).toEqual([
      { funcion: 'admin-plantaciones', cuerpo: { accion: 'eliminar', plantacionId: 'plant-1' } },
    ]);
    await usuario.click(within(dialogo).getByRole('button', { name: 'Listo' }));
    expect(await screen.findByRole('heading', { name: 'Plantaciones' })).toBeInTheDocument();
  });

  test('cancelar no borra ni sale del detalle', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1');

    const dialogo = await abrirEliminar(usuario);
    await usuario.click(await within(dialogo).findByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mendoza' })).toBeInTheDocument();
    expect(estadoMock.invocaciones).toEqual([]);
  });

  test('admin con datos: no hay botón de borrar y ofrece archivar', async () => {
    previewEliminacion = { ...PREVIEW_CON_DATOS, puede: false, motivo: 'REQUIERE_SUPERADMIN' };
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1');

    const dialogo = await abrirEliminar(usuario);
    expect(await within(dialogo).findByText(/solo un superadmin puede/)).toBeInTheDocument();
    expect(within(dialogo).queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Archivar' }));

    expect(await screen.findByRole('dialog', { name: 'Archivar Mendoza' })).toBeInTheDocument();
  });

  test('superadmin con datos sin archivar: archivala primero', async () => {
    prepararSesion(PERFIL_SUPERADMIN);
    configurarDetalleMock();
    previewEliminacion = { ...PREVIEW_CON_DATOS, puede: false, motivo: 'REQUIERE_ARCHIVAR' };
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1');

    const dialogo = await abrirEliminar(usuario);
    expect(await within(dialogo).findByText(/primero archivala/)).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Archivar' })).toBeInTheDocument();
  });

  test('superadmin con datos archivada: conteos, nombre obligatorio y aviso de fotos pendientes', async () => {
    prepararSesion(PERFIL_SUPERADMIN);
    configurarDetalleMock();
    archivadaEn = '2026-09-01T12:00:00Z';
    previewEliminacion = PREVIEW_CON_DATOS;
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1');

    const dialogo = await abrirEliminar(usuario);
    expect(
      await within(dialogo).findByText(/30 árboles \(4 árboles con foto\)/),
    ).toBeInTheDocument();
    expect(within(dialogo).getByText(/sin sincronizar, se pierden/)).toBeInTheDocument();
    const eliminar = within(dialogo).getByRole('button', { name: 'Eliminar' });
    expect(eliminar).toBeDisabled();

    const campo = within(dialogo).getByRole('textbox', {
      name: 'Escribí «Mendoza» para confirmar',
    });
    await usuario.type(campo, 'Mendoz');
    expect(eliminar).toBeDisabled();
    await usuario.type(campo, 'a');
    expect(eliminar).toBeEnabled();

    estadoMock.respuestaInvoke = { data: { ok: true, fotosPendientes: true }, error: null };
    await usuario.click(eliminar);

    expect(
      await within(dialogo).findByText(/algunas fotos no se pudieron borrar/),
    ).toBeInTheDocument();
    expect(estadoMock.invocaciones[0].cuerpo).toEqual({
      accion: 'eliminar',
      plantacionId: 'plant-1',
      nombreConfirmacion: 'Mendoza',
    });
  });

  test('superadmin reintenta la limpieza de fotos desde el resultado (#523)', async () => {
    prepararSesion(PERFIL_SUPERADMIN);
    configurarDetalleMock();
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1');

    const dialogo = await abrirEliminar(usuario);
    estadoMock.respuestaInvoke = { data: { ok: true, fotosPendientes: true }, error: null };
    await usuario.click(await within(dialogo).findByRole('button', { name: 'Eliminar' }));
    const reintentar = await within(dialogo).findByRole('button', {
      name: 'Reintentar limpieza de fotos',
    });

    estadoMock.respuestaInvoke = { data: { ok: true, limpiadas: 1, pendientes: 0 }, error: null };
    await usuario.click(reintentar);

    expect(
      await within(dialogo).findByText('No quedan fotos pendientes de borrar.'),
    ).toBeInTheDocument();
    expect(estadoMock.invocaciones[1]).toEqual({
      funcion: 'admin-plantaciones',
      cuerpo: { accion: 'limpiarFotos', plantacionId: 'plant-1' },
    });
    expect(
      within(dialogo).queryByRole('button', { name: 'Reintentar limpieza de fotos' }),
    ).not.toBeInTheDocument();
  });

  test('si la limpieza falla, el error se muestra y se puede reintentar', async () => {
    prepararSesion(PERFIL_SUPERADMIN);
    configurarDetalleMock();
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1');

    const dialogo = await abrirEliminar(usuario);
    estadoMock.respuestaInvoke = { data: { ok: true, fotosPendientes: true }, error: null };
    await usuario.click(await within(dialogo).findByRole('button', { name: 'Eliminar' }));
    const reintentar = await within(dialogo).findByRole('button', {
      name: 'Reintentar limpieza de fotos',
    });

    estadoMock.respuestaInvoke = { data: null, error: { message: 'fetch failed' } };
    await usuario.click(reintentar);

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
      'No se pudo completar la operación',
    );
    expect(
      within(dialogo).getByRole('button', { name: 'Reintentar limpieza de fotos' }),
    ).toBeEnabled();
  });

  test('un admin ve el aviso de fotos pendientes pero no puede reintentar', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1');

    const dialogo = await abrirEliminar(usuario);
    estadoMock.respuestaInvoke = { data: { ok: true, fotosPendientes: true }, error: null };
    await usuario.click(await within(dialogo).findByRole('button', { name: 'Eliminar' }));

    expect(
      await within(dialogo).findByText(/algunas fotos no se pudieron borrar/),
    ).toBeInTheDocument();
    expect(
      within(dialogo).queryByRole('button', { name: 'Reintentar limpieza de fotos' }),
    ).not.toBeInTheDocument();
  });

  test('un rechazo del server se muestra y no cierra', async () => {
    estadoMock.respuestaInvoke = {
      data: null,
      error: {
        context: { json: async () => ({ ok: false, error: 'La plantación tiene datos cargados' }) },
      },
    };
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1');

    const dialogo = await abrirEliminar(usuario);
    await usuario.click(await within(dialogo).findByRole('button', { name: 'Eliminar' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
      'La plantación tiene datos cargados',
    );
  });
});

describe('reapertura de una finalizada (#470)', () => {
  async function menuMasAcciones(usuario: Usuario) {
    await usuario.click(await screen.findByRole('button', { name: 'Más acciones' }));
    return screen.getByRole('menu', { name: 'Más acciones' });
  }

  test('un superadmin la reabre y la plantación vuelve a estar activa', async () => {
    prepararSesion(PERFIL_SUPERADMIN);
    configurarDetalleMock();
    estadoPlantacion = 'finalizada';
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1');

    const menu = await menuMasAcciones(usuario);
    await usuario.click(within(menu).getByRole('menuitem', { name: 'Reabrir plantación' }));
    const dialogo = await screen.findByRole('dialog', { name: '¿Reabrir Mendoza?' });
    // Lo que el superadmin necesita saber antes de decidir.
    expect(within(dialogo).getByText(/la app acepta registros de nuevo/)).toBeInTheDocument();
    expect(
      within(dialogo).getByText(/grupos ya finalizados siguen finalizados/),
    ).toBeInTheDocument();

    await usuario.click(within(dialogo).getByRole('button', { name: 'Reabrir' }));

    await waitFor(() =>
      expect(consultas.some((consulta) => consulta.tabla === 'reabrir_plantacion')).toBe(true),
    );
    expect(estadoPlantacion).toBe('activa');
  });

  test('un admin no ve la acción, aunque sí ve archivar', async () => {
    estadoPlantacion = 'finalizada';
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1');

    const menu = await menuMasAcciones(usuario);
    expect(within(menu).queryByRole('menuitem', { name: 'Reabrir plantación' })).toBeNull();
    expect(within(menu).getByRole('menuitem', { name: 'Archivar plantación' })).toBeInTheDocument();
  });

  test('sobre una activa no se ofrece', async () => {
    prepararSesion(PERFIL_SUPERADMIN);
    configurarDetalleMock();
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1');

    const menu = await menuMasAcciones(usuario);
    expect(within(menu).queryByRole('menuitem', { name: 'Reabrir plantación' })).toBeNull();
  });
});
