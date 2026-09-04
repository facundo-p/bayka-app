import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PERFIL_ADMIN, estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import { renderRutasEn } from '../../test/renderConRutas';
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
  { id: 'user-2', nombre: 'Beto Técnico', rol: 'tecnico', activo: true },
  { id: 'user-3', nombre: 'Carla Campo', rol: 'admin', activo: true },
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
    if (consulta.tabla === 'plantations') {
      const filtroId = consulta.filtros.find((filtro) => filtro.columna === 'id');
      return { data: filtroId?.valor === FILA_PLANTACION.id ? FILA_PLANTACION : null };
    }
    if (consulta.tabla === 'profiles') return { data: PERFILES };
    if (consulta.tabla === 'plantation_users') return resolverPlantationUsers(consulta);
    if (consulta.tabla === 'trees') {
      // La query de exportación se distingue por seleccionar `plantacion_id`.
      if (consulta.columnas?.includes('plantacion_id')) return { data: filasExport };
      // seedSugerido: pide una sola fila (MAX global_id vía orden desc + limit 1).
      if (consulta.limite === 1) return { data: [{ global_id: 1000 }] };
      // El conteo "sólo con id" se distingue por el filtro sobre global_id.
      const soloConId = consulta.filtros.some((filtro) => filtro.columna === 'global_id');
      return { data: [], count: soloConId ? conIdArboles : totalArboles };
    }
    return { data: [], count: 0 };
  };
}

beforeEach(() => {
  resetEstadoMock();
  estadoMock.sesion = { user: { id: 'user-1' } };
  estadoMock.perfilFila = PERFIL_ADMIN;
  asignadas = [filaAsignada('user-2', 'tecnico')];
  consultas = [];
  totalArboles = 0;
  conIdArboles = 0;
  filasExport = [];
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
  // el modal se cierra y aparecen los botones de exportación.
  expect(await screen.findByRole('button', { name: 'Exportar Excel' })).toBeEnabled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Generar IDs/ })).not.toBeInTheDocument();
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
    consulta.operacion === 'rpc'
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

test('ofrece "Exportar Excel" y "Exportar CSV" (y oculta "Generar IDs") con los IDs generados', async () => {
  totalArboles = 5;
  conIdArboles = 5; // todos con global_id → generado
  renderRutasEn('/plantaciones/plant-1');

  expect(await screen.findByRole('button', { name: 'Exportar Excel' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: /Generar IDs/ })).not.toBeInTheDocument();
});

test('exportar sin árboles muestra el mensaje en vez de descargar una planilla vacía', async () => {
  const usuario = userEvent.setup();
  totalArboles = 5;
  conIdArboles = 5;
  filasExport = []; // la query de exportación no devuelve filas
  renderRutasEn('/plantaciones/plant-1');

  await usuario.click(await screen.findByRole('button', { name: 'Exportar Excel' }));
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

  await usuario.click(await screen.findByRole('button', { name: 'Exportar CSV' }));

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

  await usuario.click(await screen.findByRole('button', { name: 'Exportar Excel' }));

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
  await usuario.selectOptions(within(dialogo).getByLabelText('Usuario'), 'user-3');
  await usuario.click(within(dialogo).getByRole('button', { name: 'Asignar' }));

  expect(await screen.findByText('Carla Campo')).toBeInTheDocument();
  const insercion = consultas.find((consulta) => consulta.operacion === 'insert');
  expect(insercion?.tabla).toBe('plantation_users');
  expect(insercion?.payload).toEqual({
    plantation_id: 'plant-1',
    user_id: 'user-3',
    rol_en_plantacion: 'tecnico',
  });
});

test('el select del modal no lista a los ya asignados', async () => {
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones/plant-1/configuracion');
  await screen.findByText('Beto Técnico');

  await usuario.click(screen.getByRole('button', { name: /Asignar técnico/ }));
  const select = within(screen.getByRole('dialog')).getByLabelText('Usuario');
  expect(within(select).getByRole('option', { name: 'Carla Campo' })).toBeInTheDocument();
  expect(within(select).queryByRole('option', { name: 'Beto Técnico' })).not.toBeInTheDocument();
});

test('el select no ofrece usuarios dados de baja', async () => {
  const resolverBase = estadoMock.resolverConsulta!;
  estadoMock.resolverConsulta = (consulta) =>
    consulta.tabla === 'profiles'
      ? {
          data: [
            { id: 'user-3', nombre: 'Carla Campo', rol: 'admin', activo: true },
            { id: 'user-4', nombre: 'Dina Baja', rol: 'tecnico', activo: false },
          ],
        }
      : resolverBase(consulta);
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones/plant-1/configuracion');
  await screen.findByText('Beto Técnico');

  await usuario.click(screen.getByRole('button', { name: /Asignar técnico/ }));
  const select = within(screen.getByRole('dialog')).getByLabelText('Usuario');
  expect(within(select).getByRole('option', { name: 'Carla Campo' })).toBeInTheDocument();
  expect(within(select).queryByRole('option', { name: 'Dina Baja' })).not.toBeInTheDocument();
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
