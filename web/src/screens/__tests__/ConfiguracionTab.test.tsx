import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { estadoMock, prepararSesionAdmin } from '../../test/supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import { renderRutasEn } from '../../test/renderConRutas';
import { espiarInvalidaciones } from '../../test/espiarInvalidaciones';
import { MENSAJE_CONFLICTO_EDICION } from '../../repositories/edicionDePlantacion';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

const CATALOGO = [
  { id: 'sp-2', codigo: 'AL', nombre: 'Algarrobo', nombre_cientifico: null },
  { id: 'sp-3', codigo: 'CE', nombre: 'Ceibo', nombre_cientifico: 'Erythrina crista-galli' },
  { id: 'sp-1', codigo: 'QB', nombre: 'Quebracho', nombre_cientifico: 'Schinopsis balansae' },
];

/** Altas y bajas de especies en una transacción (058, #635). */
const RPC_CAMBIOS_ESPECIES = 'aplicar_cambios_especies';

/** La edición de campos de la plantación va por RPC, con base (#634). */
const RPC_EDICION = 'editar_plantacion';

const PERFILES = [
  { id: 'tec-1', nombre: 'Lucía Ferreyra', rol: 'tecnico', email: 'lucia@bayka.app', activo: true },
  { id: 'tec-2', nombre: 'Pablo Ríos', rol: 'tecnico', email: 'pablo@bayka.app', activo: true },
];

/** Estado mutable del mock: los updates/inserts lo modifican como la base. */
let filaPlantacion: Record<string, unknown>;
let asignadas: Array<{ species_id: string; orden_visual: number }>;
let tecnicosAsignados: string[];
let arbolesPorEspecie: Record<string, number>;
/** Si está, el RPC de edición responde esto en vez de aplicar los cambios. */
let respuestaEdicion: RespuestaMock | null;
let consultas: ConsultaCapturada[];

function filaAsignadaConEmbed(asignada: { species_id: string; orden_visual: number }) {
  return { ...asignada, species: CATALOGO.find((especie) => especie.id === asignada.species_id) };
}

function resolverEdicion(consulta: ConsultaCapturada): RespuestaMock {
  if (respuestaEdicion) return respuestaEdicion;
  Object.assign(filaPlantacion, (consulta.payload as { p_cambios: object }).p_cambios);
  return { data: { success: true } };
}

function resolverPlantations(consulta: ConsultaCapturada): RespuestaMock {
  const filtroId = consulta.filtros.find((filtro) => filtro.columna === 'id');
  return { data: filtroId?.valor === filaPlantacion.id ? filaPlantacion : null };
}

function resolverPlantationSpecies(): RespuestaMock {
  return { data: asignadas.map(filaAsignadaConEmbed) };
}

/** Doble del RPC: aplica altas y bajas sobre lo asignado, como la base. */
function resolverCambiosEspecies(consulta: ConsultaCapturada): RespuestaMock {
  const { p_altas: altas, p_bajas: bajas } = consulta.payload as {
    p_altas: string[];
    p_bajas: string[];
  };
  asignadas = asignadas.filter((fila) => !bajas.includes(fila.species_id));
  const nuevas = altas.filter((id) => !asignadas.some((fila) => fila.species_id === id));
  asignadas.push(...nuevas.map((species_id) => ({ species_id, orden_visual: 0 })));
  return { data: { success: true, rechazadas: [] } };
}

function filaTecnicoAsignado(userId: string) {
  const perfil = PERFILES.find((candidato) => candidato.id === userId);
  return {
    user_id: userId,
    rol_en_plantacion: 'tecnico',
    assigned_at: '2026-06-12T12:00:00Z',
    profiles: { nombre: perfil?.nombre ?? '', rol: 'tecnico' },
  };
}

function resolverPlantationUsers(consulta: ConsultaCapturada): RespuestaMock {
  if (consulta.operacion === 'insert') {
    tecnicosAsignados.push((consulta.payload as { user_id: string }).user_id);
    return { data: null };
  }
  if (consulta.operacion === 'delete') {
    const userId = consulta.filtros.find((filtro) => filtro.columna === 'user_id')?.valor;
    tecnicosAsignados = tecnicosAsignados.filter((id) => id !== userId);
    return { data: null };
  }
  return { data: tecnicosAsignados.map(filaTecnicoAsignado) };
}

function resolverTrees(consulta: ConsultaCapturada): RespuestaMock {
  const especieId = consulta.filtros.find((filtro) => filtro.columna === 'species_id')?.valor;
  return { count: arbolesPorEspecie[String(especieId)] ?? 0 };
}

function configurarMock(): void {
  estadoMock.resolverConsulta = (consulta) => {
    consultas.push(consulta);
    if (consulta.tabla === 'plantations') return resolverPlantations(consulta);
    if (consulta.tabla === 'plantation_species') return resolverPlantationSpecies();
    if (consulta.tabla === RPC_CAMBIOS_ESPECIES) return resolverCambiosEspecies(consulta);
    if (consulta.tabla === RPC_EDICION) return resolverEdicion(consulta);
    if (consulta.tabla === 'trees') return resolverTrees(consulta);
    if (consulta.tabla === 'species') return { data: CATALOGO };
    if (consulta.tabla === 'plantation_users') return resolverPlantationUsers(consulta);
    if (consulta.tabla === 'profiles') return { data: PERFILES };
    return { data: [], count: 0 };
  };
}

beforeEach(() => {
  prepararSesionAdmin();
  filaPlantacion = {
    id: 'plant-1',
    lugar: 'Mendoza',
    periodo: '2025-2026',
    estado: 'activa',
    created_at: '2026-06-12T12:00:00Z',
    visible_in_app: true,
    gps_capture_frequency: 10,
    gps_capture_required: true,
    photo_capture_all_trees: false,
  };
  asignadas = [
    { species_id: 'sp-1', orden_visual: 0 },
    { species_id: 'sp-2', orden_visual: 1 },
  ];
  arbolesPorEspecie = { 'sp-1': 3 };
  tecnicosAsignados = [];
  respuestaEdicion = null;
  consultas = [];
  configurarMock();
});

/** Los cambios que mandó cada llamada al RPC de edición. */
function cambiosEditados(): Record<string, unknown>[] {
  return consultas
    .filter((consulta) => consulta.tabla === RPC_EDICION)
    .map((consulta) => (consulta.payload as { p_cambios: Record<string, unknown> }).p_cambios);
}

function conflictoEn(campo: string, valorServidor: unknown): RespuestaMock {
  return {
    data: {
      success: false,
      error: 'CONFLICTO_EDICION',
      aplicados: [],
      conflictos: [{ campo, valor_servidor: valorServidor, editado_por: 'Ana', editado_en: null }],
    },
  };
}

function cambiosDeEspecies(): ConsultaCapturada[] {
  return consultas.filter((consulta) => consulta.tabla === RPC_CAMBIOS_ESPECIES);
}

describe('checklist de especies', () => {
  test('refleja habilitadas/no habilitadas y bloquea las que tienen árboles', async () => {
    renderRutasEn('/plantaciones/plant-1/configuracion');
    const quebracho = await screen.findByRole('checkbox', { name: 'Quebracho' });

    // Quebracho (sp-1) tiene árboles → marcada y deshabilitada.
    expect(quebracho).toBeChecked();
    expect(quebracho).toBeDisabled();
    expect(quebracho).toHaveAttribute('title', expect.stringContaining('árboles'));
    // Algarrobo (sp-2) habilitada sin árboles; Ceibo (sp-3) no habilitada.
    expect(screen.getByRole('checkbox', { name: 'Algarrobo' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Ceibo' })).not.toBeChecked();
  });

  test('habilitar una especie manda solo esa alta', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await usuario.click(await screen.findByRole('checkbox', { name: 'Ceibo' }));

    await waitFor(() => expect(cambiosDeEspecies()).toHaveLength(1));
    expect(cambiosDeEspecies()[0].payload).toEqual({
      p_plantacion: 'plant-1',
      p_altas: ['sp-3'],
      p_bajas: [],
    });
  });

  test('deshabilitar una especie sin árboles la quita', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await usuario.click(await screen.findByRole('checkbox', { name: 'Algarrobo' }));

    await waitFor(() => expect(cambiosDeEspecies()).toHaveLength(1));
    expect(cambiosDeEspecies()[0].payload).toEqual({
      p_plantacion: 'plant-1',
      p_altas: [],
      p_bajas: ['sp-2'],
    });
  });

  test('no se puede desmarcar una especie con árboles', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await usuario.click(await screen.findByRole('checkbox', { name: 'Quebracho' }));

    expect(cambiosDeEspecies()).toHaveLength(0);
  });

  test('el buscador filtra por nombre/código', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await screen.findByRole('checkbox', { name: 'Quebracho' });

    await usuario.type(screen.getByPlaceholderText(/Buscar especie/), 'ceib');

    expect(screen.getByRole('checkbox', { name: 'Ceibo' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Quebracho' })).not.toBeInTheDocument();
  });
});

describe('checkbox maestro (marcar/desmarcar todas)', () => {
  test('parcial: marca todas las visibles e inserta las faltantes', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    const maestro = await screen.findByRole('checkbox', { name: 'Marcar todas' });
    // sp-1 y sp-2 habilitadas de 3 visibles → indeterminado.
    expect(maestro).toHaveAttribute('aria-checked', 'mixed');

    await usuario.click(maestro);

    await waitFor(() => expect(cambiosDeEspecies()).toHaveLength(1));
    // Un solo request, solo con la que falta: las que ya estaban no viajan.
    expect(cambiosDeEspecies()[0].payload).toEqual({
      p_plantacion: 'plant-1',
      p_altas: ['sp-3'],
      p_bajas: [],
    });
    expect(await screen.findByText(/^3 habilitadas ·/)).toBeInTheDocument();
    await waitFor(() => expect(maestro).toHaveAttribute('aria-checked', 'true'));
  });

  test('desmarca todas dejando las bloqueadas y avisa con el conteo', async () => {
    const usuario = userEvent.setup();
    asignadas = [
      { species_id: 'sp-1', orden_visual: 0 },
      { species_id: 'sp-2', orden_visual: 1 },
      { species_id: 'sp-3', orden_visual: 2 },
    ];
    renderRutasEn('/plantaciones/plant-1/configuracion');
    const maestro = await screen.findByRole('checkbox', { name: 'Marcar todas' });
    await waitFor(() => expect(maestro).toHaveAttribute('aria-checked', 'true'));

    await usuario.click(maestro);

    await waitFor(() => expect(cambiosDeEspecies()).toHaveLength(1));
    // sp-1 tiene árboles → no se pide su baja.
    expect(cambiosDeEspecies()[0].payload).toEqual({
      p_plantacion: 'plant-1',
      p_altas: [],
      p_bajas: ['sp-2', 'sp-3'],
    });
    expect(
      await screen.findByText(/1 especie quedó habilitada porque tiene árboles/),
    ).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: 'Quebracho' })).toBeChecked();
  });

  test('todas bloqueadas: no borra nada y avisa por todas', async () => {
    const usuario = userEvent.setup();
    asignadas = [
      { species_id: 'sp-1', orden_visual: 0 },
      { species_id: 'sp-2', orden_visual: 1 },
      { species_id: 'sp-3', orden_visual: 2 },
    ];
    arbolesPorEspecie = { 'sp-1': 3, 'sp-2': 1, 'sp-3': 5 };
    renderRutasEn('/plantaciones/plant-1/configuracion');
    const maestro = await screen.findByRole('checkbox', { name: 'Marcar todas' });
    await waitFor(() => expect(maestro).toHaveAttribute('aria-checked', 'true'));

    await usuario.click(maestro);

    expect(await screen.findByText(/3 especies quedaron habilitadas/)).toBeInTheDocument();
    expect(cambiosDeEspecies()).toHaveLength(0);
  });

  test('sin bloqueadas: desmarcar vacía el checklist sin aviso', async () => {
    const usuario = userEvent.setup();
    asignadas = [
      { species_id: 'sp-2', orden_visual: 0 },
      { species_id: 'sp-3', orden_visual: 1 },
    ];
    arbolesPorEspecie = {};
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await screen.findByRole('checkbox', { name: 'Ceibo' });
    // Sólo sp-2 y sp-3 habilitadas → parcial; una marcada las lleva a todas.
    const maestro = screen.getByRole('checkbox', { name: 'Marcar todas' });
    await usuario.click(maestro); // marcar sp-1 → todas
    await waitFor(() => expect(maestro).toHaveAttribute('aria-checked', 'true'));

    await usuario.click(maestro); // desmarcar todas (ninguna bloqueada)

    await waitFor(() => expect(screen.getByText(/^0 habilitadas ·/)).toBeInTheDocument());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('con búsqueda activa opera sólo sobre las filas visibles', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await screen.findByRole('checkbox', { name: 'Quebracho' });
    await usuario.type(screen.getByPlaceholderText(/Buscar especie/), 'ceib');

    // Sólo Ceibo (sp-3, no habilitada) visible → maestro vacío.
    const maestro = screen.getByRole('checkbox', { name: 'Marcar todas' });
    expect(maestro).toHaveAttribute('aria-checked', 'false');
    await usuario.click(maestro);

    await waitFor(() => expect(cambiosDeEspecies()).toHaveLength(1));
    // Las no visibles no se tocan ni viajan.
    expect(cambiosDeEspecies()[0].payload).toEqual({
      p_plantacion: 'plant-1',
      p_altas: ['sp-3'],
      p_bajas: [],
    });
  });
});

describe('sección GPS', () => {
  function updatesGps(): Record<string, unknown>[] {
    return cambiosEditados().filter(
      (cambios) =>
        cambios.gps_capture_frequency !== undefined || cambios.gps_capture_required !== undefined,
    );
  }

  test('elegir un preset persiste la nueva frecuencia', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await screen.findByRole('checkbox', { name: 'Quebracho' });

    // El preset 10 arranca activo (gps_capture_frequency = 10).
    const radio10 = screen.getByRole('radio', { name: /10/ });
    expect(radio10).toHaveAttribute('aria-checked', 'true');
    await usuario.click(screen.getByRole('radio', { name: /5/ }));

    await waitFor(() => expect(updatesGps()).toHaveLength(1));
    expect(updatesGps()[0]).toEqual({ gps_capture_frequency: 5 });
  });

  test('una frecuencia no preset deja sin preset activo y resalta el input', async () => {
    filaPlantacion.gps_capture_frequency = 7;
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await screen.findByRole('checkbox', { name: 'Quebracho' });

    // Ningún preset queda activo.
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveAttribute('aria-checked', 'false');
    }
    const exacto = screen.getByLabelText(/valor exacto/);
    expect(exacto).toHaveValue(7);
  });

  test('el input numérico inválido no toca la base', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await screen.findByRole('checkbox', { name: 'Quebracho' });

    const exacto = screen.getByLabelText(/valor exacto/);
    await usuario.clear(exacto);
    await usuario.type(exacto, '0');

    expect(updatesGps()).toHaveLength(0);
  });

  test('el toggle de obligatoria persiste y muestra el hint', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await screen.findByRole('checkbox', { name: 'Quebracho' });

    expect(screen.getByText('El técnico no puede registrar sin GPS')).toBeInTheDocument();
    await usuario.click(screen.getByRole('switch', { name: 'Captura de GPS obligatoria' }));

    await waitFor(() => expect(updatesGps()).toHaveLength(1));
    expect(updatesGps()[0]).toEqual({ gps_capture_required: false });
  });

  test('si otro cambió la frecuencia, muestra el aviso y queda la del server', async () => {
    const usuario = userEvent.setup();
    respuestaEdicion = conflictoEn('gps_capture_frequency', 20);
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await screen.findByRole('checkbox', { name: 'Quebracho' });

    await usuario.click(screen.getByRole('radio', { name: /5/ }));

    expect(await screen.findByText(MENSAJE_CONFLICTO_EDICION)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /20/ })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('sección Técnicos', () => {
  test('abrir el modal y asignar inserta el usuario', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await screen.findByRole('checkbox', { name: 'Quebracho' });

    await usuario.click(screen.getByRole('button', { name: /Asignar técnico/ }));
    const dialogo = screen.getByRole('dialog', { name: 'Asignar técnico' });
    expect(within(dialogo).getByRole('button', { name: /^Técnico/ })).toBeInTheDocument();
    expect(within(dialogo).queryByText('Rol en plantación')).not.toBeInTheDocument();
  });

  test('asignar un técnico lo suma a la card y refresca Usuarios y su panel', async () => {
    const invalidaciones = espiarInvalidaciones();
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    expect(await screen.findByText('0 asignados')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /Asignar técnico/ }));
    const dialogo = screen.getByRole('dialog', { name: 'Asignar técnico' });
    await usuario.click(within(dialogo).getByRole('button', { name: /^Técnico/ }));
    await usuario.click(screen.getByRole('option', { name: /Pablo Ríos/ }));
    await usuario.click(within(dialogo).getByRole('button', { name: 'Asignar' }));

    expect(await screen.findByText('1 asignado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar Pablo Ríos' })).toBeInTheDocument();
    expect(invalidaciones).toHaveBeenCalledTimes(4);
    expect(invalidaciones).toHaveBeenCalledWith({ queryKey: ['plantacion-usuarios', 'plant-1'] });
    expect(invalidaciones).toHaveBeenCalledWith({ queryKey: ['plantaciones'] });
    expect(invalidaciones).toHaveBeenCalledWith({ queryKey: ['usuarios'] });
    expect(invalidaciones).toHaveBeenCalledWith({ queryKey: ['usuario-plantaciones', 'tec-2'] });
  });

  test('quitar un técnico lo saca de la card y refresca Usuarios y su panel', async () => {
    tecnicosAsignados = ['tec-1'];
    const invalidaciones = espiarInvalidaciones();
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');

    await usuario.click(await screen.findByRole('button', { name: 'Quitar Lucía Ferreyra' }));
    const dialogo = screen.getByRole('dialog', { name: 'Quitar usuario' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Quitar' }));

    expect(await screen.findByText('0 asignados')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar Lucía Ferreyra' })).not.toBeInTheDocument();
    expect(invalidaciones).toHaveBeenCalledTimes(4);
    expect(invalidaciones).toHaveBeenCalledWith({ queryKey: ['plantacion-usuarios', 'plant-1'] });
    expect(invalidaciones).toHaveBeenCalledWith({ queryKey: ['plantaciones'] });
    expect(invalidaciones).toHaveBeenCalledWith({ queryKey: ['usuarios'] });
    expect(invalidaciones).toHaveBeenCalledWith({ queryKey: ['usuario-plantaciones', 'tec-1'] });
  });
});

describe('sección Foto en todos los botones', () => {
  test('guarda al cambiar y refleja el nuevo estado del toggle', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    const toggle = await screen.findByRole('switch', { name: 'Foto en todos los botones' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await usuario.click(toggle);

    await waitFor(() => expect(cambiosEditados()).toEqual([{ photo_capture_all_trees: true }]));
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
  });

  test('una plantación archivada en el server vuelve el toggle atrás con el motivo', async () => {
    const usuario = userEvent.setup();
    respuestaEdicion = { data: { success: false, error: 'PLANTACION_ARCHIVADA' } };
    renderRutasEn('/plantaciones/plant-1/configuracion');
    const toggle = await screen.findByRole('switch', { name: 'Foto en todos los botones' });

    await usuario.click(toggle);

    expect(await screen.findByText(/desarchivala/)).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
});

describe('sección Visibilidad', () => {
  test('guarda al cambiar y refleja el nuevo estado del toggle', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    const toggle = await screen.findByRole('switch', { name: 'Visible para técnicos en la app' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    await usuario.click(toggle);

    await waitFor(() => expect(cambiosEditados()).toEqual([{ visible_in_app: false }]));
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
  });

  test('si el update falla hace rollback visual del toggle', async () => {
    const usuario = userEvent.setup();
    respuestaEdicion = { error: { message: 'TypeError: Failed to fetch' } };
    renderRutasEn('/plantaciones/plant-1/configuracion');
    const toggle = await screen.findByRole('switch', { name: 'Visible para técnicos en la app' });

    await usuario.click(toggle);

    expect(
      await screen.findByText(
        'No se pudo actualizar la visibilidad. Revisá tu conexión y probá de nuevo.',
      ),
    ).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  test('una plantación finalizada en el server muestra el rechazo', async () => {
    const usuario = userEvent.setup();
    respuestaEdicion = { data: { success: false, error: 'PLANTACION_FINALIZADA' } };
    renderRutasEn('/plantaciones/plant-1/configuracion');
    const toggle = await screen.findByRole('switch', { name: 'Visible para técnicos en la app' });

    await usuario.click(toggle);

    expect(await screen.findByText(/está finalizada/)).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});
