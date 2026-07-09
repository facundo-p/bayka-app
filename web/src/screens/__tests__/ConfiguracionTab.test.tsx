import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PERFIL_ADMIN, estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import { renderRutasEn } from '../../test/renderConRutas';
import { PG_ERROR } from '../../lib/postgresErrorCodes';
import {
  MENSAJE_GPS_SIN_MIGRACION,
  MENSAJE_VISIBILIDAD_SIN_MIGRACION,
} from '../../repositories/plantationRepository';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

const CATALOGO = [
  { id: 'sp-2', codigo: 'AL', nombre: 'Algarrobo', nombre_cientifico: null },
  { id: 'sp-3', codigo: 'CE', nombre: 'Ceibo', nombre_cientifico: 'Erythrina crista-galli' },
  { id: 'sp-1', codigo: 'QB', nombre: 'Quebracho', nombre_cientifico: 'Schinopsis balansae' },
];

/** Estado mutable del mock: los updates/inserts lo modifican como la base. */
let filaPlantacion: Record<string, unknown>;
let asignadas: Array<{ species_id: string; orden_visual: number }>;
let arbolesPorEspecie: Record<string, number>;
let errorUpdatePlantations: { message: string; code?: string } | null;
let consultas: ConsultaCapturada[];

function filaAsignadaConEmbed(asignada: { species_id: string; orden_visual: number }) {
  return { ...asignada, species: CATALOGO.find((especie) => especie.id === asignada.species_id) };
}

function resolverPlantations(consulta: ConsultaCapturada): RespuestaMock {
  if (consulta.operacion === 'update') {
    if (errorUpdatePlantations) return { error: errorUpdatePlantations };
    Object.assign(filaPlantacion, consulta.payload);
    return { data: null };
  }
  const filtroId = consulta.filtros.find((filtro) => filtro.columna === 'id');
  return { data: filtroId?.valor === filaPlantacion.id ? filaPlantacion : null };
}

function resolverPlantationSpecies(consulta: ConsultaCapturada): RespuestaMock {
  if (consulta.operacion === 'insert') {
    // El toggle individual inserta una fila; el batch inserta un array.
    const filas = Array.isArray(consulta.payload) ? consulta.payload : [consulta.payload];
    asignadas.push(...(filas as Array<{ species_id: string; orden_visual: number }>));
    return { data: null };
  }
  if (consulta.operacion === 'delete') {
    const filtroEspecie = consulta.filtros.find((filtro) => filtro.columna === 'species_id');
    // eq (toggle) → un id; in (batch) → array de ids.
    const ids =
      filtroEspecie?.metodo === 'in'
        ? (filtroEspecie.valor as string[])
        : [filtroEspecie?.valor];
    asignadas = asignadas.filter((fila) => !ids.includes(fila.species_id));
    return { data: null };
  }
  return { data: asignadas.map(filaAsignadaConEmbed) };
}

function resolverTrees(consulta: ConsultaCapturada): RespuestaMock {
  const especieId = consulta.filtros.find((filtro) => filtro.columna === 'species_id')?.valor;
  return { count: arbolesPorEspecie[String(especieId)] ?? 0 };
}

function configurarMock(): void {
  estadoMock.resolverConsulta = (consulta) => {
    consultas.push(consulta);
    if (consulta.tabla === 'plantations') return resolverPlantations(consulta);
    if (consulta.tabla === 'plantation_species') return resolverPlantationSpecies(consulta);
    if (consulta.tabla === 'trees') return resolverTrees(consulta);
    if (consulta.tabla === 'species') return { data: CATALOGO };
    return { data: [], count: 0 };
  };
}

beforeEach(() => {
  resetEstadoMock();
  estadoMock.sesion = { user: { id: 'user-1' } };
  estadoMock.perfilFila = PERFIL_ADMIN;
  filaPlantacion = {
    id: 'plant-1',
    lugar: 'Mendoza',
    periodo: '2025-2026',
    estado: 'activa',
    created_at: '2026-06-12T12:00:00Z',
    visible_in_app: true,
    gps_capture_frequency: 10,
    gps_capture_required: true,
  };
  asignadas = [
    { species_id: 'sp-1', orden_visual: 0 },
    { species_id: 'sp-2', orden_visual: 1 },
  ];
  arbolesPorEspecie = { 'sp-1': 3 };
  errorUpdatePlantations = null;
  consultas = [];
  configurarMock();
});

function consultasEspecies(operacion: ConsultaCapturada['operacion']): ConsultaCapturada[] {
  return consultas.filter(
    (consulta) => consulta.tabla === 'plantation_species' && consulta.operacion === operacion,
  );
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

  test('habilitar una especie inserta con orden_visual = cantidad habilitada', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await usuario.click(await screen.findByRole('checkbox', { name: 'Ceibo' }));

    await waitFor(() => expect(consultasEspecies('insert')).toHaveLength(1));
    expect(consultasEspecies('insert')[0].payload).toEqual({
      plantation_id: 'plant-1',
      species_id: 'sp-3',
      orden_visual: 2,
    });
  });

  test('deshabilitar una especie sin árboles la quita', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await usuario.click(await screen.findByRole('checkbox', { name: 'Algarrobo' }));

    await waitFor(() => expect(consultasEspecies('delete')).toHaveLength(1));
    expect(consultasEspecies('delete')[0].filtros).toEqual([
      { metodo: 'eq', columna: 'plantation_id', valor: 'plant-1' },
      { metodo: 'eq', columna: 'species_id', valor: 'sp-2' },
    ]);
  });

  test('no se puede desmarcar una especie con árboles', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await usuario.click(await screen.findByRole('checkbox', { name: 'Quebracho' }));

    expect(consultasEspecies('delete')).toHaveLength(0);
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
    const maestro = await screen.findByRole('checkbox', { name: 'Todas las especies' });
    // sp-1 y sp-2 habilitadas de 3 visibles → indeterminado.
    expect(maestro).toHaveAttribute('aria-checked', 'mixed');

    await usuario.click(maestro);

    await waitFor(() => expect(consultasEspecies('insert')).toHaveLength(1));
    // Batch: un solo insert con la única faltante (sp-3).
    expect(consultasEspecies('insert')[0].payload).toEqual([
      { plantation_id: 'plant-1', species_id: 'sp-3', orden_visual: 2 },
    ]);
    expect(await screen.findByText('3 habilitadas')).toBeInTheDocument();
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
    const maestro = await screen.findByRole('checkbox', { name: 'Todas las especies' });
    await waitFor(() => expect(maestro).toHaveAttribute('aria-checked', 'true'));

    await usuario.click(maestro);

    await waitFor(() => expect(consultasEspecies('delete')).toHaveLength(1));
    // sp-1 tiene árboles → no se borra; batch borra sp-2 y sp-3 con `in`.
    const filtro = consultasEspecies('delete')[0].filtros.find((f) => f.columna === 'species_id');
    expect(filtro).toEqual({ metodo: 'in', columna: 'species_id', valor: ['sp-2', 'sp-3'] });
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
    const maestro = await screen.findByRole('checkbox', { name: 'Todas las especies' });
    await waitFor(() => expect(maestro).toHaveAttribute('aria-checked', 'true'));

    await usuario.click(maestro);

    expect(await screen.findByText(/3 especies quedaron habilitadas/)).toBeInTheDocument();
    expect(consultasEspecies('delete')).toHaveLength(0);
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
    const maestro = screen.getByRole('checkbox', { name: 'Todas las especies' });
    await usuario.click(maestro); // marcar sp-1 → todas
    await waitFor(() => expect(maestro).toHaveAttribute('aria-checked', 'true'));

    await usuario.click(maestro); // desmarcar todas (ninguna bloqueada)

    await waitFor(() => expect(screen.getByText('0 habilitadas')).toBeInTheDocument());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('con búsqueda activa opera sólo sobre las filas visibles', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await screen.findByRole('checkbox', { name: 'Quebracho' });
    await usuario.type(screen.getByPlaceholderText(/Buscar especie/), 'ceib');

    // Sólo Ceibo (sp-3, no habilitada) visible → maestro vacío.
    const maestro = screen.getByRole('checkbox', { name: 'Todas las especies' });
    expect(maestro).toHaveAttribute('aria-checked', 'false');
    await usuario.click(maestro);

    await waitFor(() => expect(consultasEspecies('insert')).toHaveLength(1));
    expect(consultasEspecies('insert')[0].payload).toEqual([
      { plantation_id: 'plant-1', species_id: 'sp-3', orden_visual: 2 },
    ]);
  });
});

describe('sección GPS', () => {
  function updatesGps(): ConsultaCapturada[] {
    return consultas.filter(
      (consulta) =>
        consulta.tabla === 'plantations' &&
        consulta.operacion === 'update' &&
        (consulta.payload as Record<string, unknown>).gps_capture_frequency !== undefined,
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
    expect(updatesGps()[0].payload).toMatchObject({ gps_capture_frequency: 5 });
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
    await usuario.click(screen.getByRole('switch', { name: 'Captura obligatoria' }));

    await waitFor(() => expect(updatesGps()).toHaveLength(1));
    expect(updatesGps()[0].payload).toMatchObject({ gps_capture_required: false });
  });

  test('si falta la migración 023 muestra el mensaje y no rompe', async () => {
    const usuario = userEvent.setup();
    errorUpdatePlantations = {
      message: 'column "gps_capture_frequency" does not exist',
      code: PG_ERROR.UNDEFINED_COLUMN,
    };
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await screen.findByRole('checkbox', { name: 'Quebracho' });

    await usuario.click(screen.getByRole('radio', { name: /5/ }));

    expect(await screen.findByText(MENSAJE_GPS_SIN_MIGRACION)).toBeInTheDocument();
  });
});

describe('sección Técnicos', () => {
  test('abrir el modal y asignar inserta el usuario', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await screen.findByRole('checkbox', { name: 'Quebracho' });

    await usuario.click(screen.getByRole('button', { name: /Asignar técnico/ }));
    const dialogo = screen.getByRole('dialog', { name: 'Asignar técnico' });
    expect(within(dialogo).getByLabelText('Usuario')).toBeInTheDocument();
  });
});

describe('sección Visibilidad', () => {
  test('guarda al cambiar y refleja el nuevo estado del toggle', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    const toggle = await screen.findByRole('switch', { name: 'Visible para técnicos en la app' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    await usuario.click(toggle);

    const update = consultas.find(
      (consulta) => consulta.tabla === 'plantations' && consulta.operacion === 'update',
    );
    expect(update?.payload).toEqual({ visible_in_app: false });
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
  });

  test('si el update falla hace rollback visual del toggle', async () => {
    const usuario = userEvent.setup();
    errorUpdatePlantations = { message: 'sin permisos' };
    renderRutasEn('/plantaciones/plant-1/configuracion');
    const toggle = await screen.findByRole('switch', { name: 'Visible para técnicos en la app' });

    await usuario.click(toggle);

    expect(await screen.findByText('No se pudo actualizar la visibilidad.')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  test('si falta la migración 024 muestra el mensaje de migración', async () => {
    const usuario = userEvent.setup();
    errorUpdatePlantations = {
      message: 'column "visible_in_app" does not exist',
      code: PG_ERROR.UNDEFINED_COLUMN,
    };
    renderRutasEn('/plantaciones/plant-1/configuracion');
    const toggle = await screen.findByRole('switch', { name: 'Visible para técnicos en la app' });

    await usuario.click(toggle);

    expect(await screen.findByText(MENSAJE_VISIBILIDAD_SIN_MIGRACION)).toBeInTheDocument();
  });
});
