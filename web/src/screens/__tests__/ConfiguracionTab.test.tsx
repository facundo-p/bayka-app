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
    asignadas.push(consulta.payload as { species_id: string; orden_visual: number });
    return { data: null };
  }
  if (consulta.operacion === 'delete') {
    const especieId = consulta.filtros.find((filtro) => filtro.columna === 'species_id')?.valor;
    asignadas = asignadas.filter((fila) => fila.species_id !== especieId);
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

function filaDe(nombre: string): HTMLElement {
  const fila = screen.getByRole('cell', { name: nombre }).closest('tr');
  if (!fila) throw new Error(`No se encontró la fila de ${nombre}`);
  return fila;
}

describe('sección Especies', () => {
  test('quitar está deshabilitado solo para especies con árboles registrados', async () => {
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await screen.findByRole('cell', { name: 'Quebracho' });

    const quitarQuebracho = within(filaDe('Quebracho')).getByRole('button', { name: 'Quitar' });
    expect(quitarQuebracho).toBeDisabled();
    expect(quitarQuebracho).toHaveAttribute('title', expect.stringContaining('árboles registrados'));
    expect(within(filaDe('Algarrobo')).getByRole('button', { name: 'Quitar' })).toBeEnabled();
  });

  test('agrega una especie del catálogo con orden_visual máximo + 1', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await screen.findByRole('cell', { name: 'Quebracho' });

    // El select solo ofrece las especies aún no habilitadas.
    const select = screen.getByLabelText('Especie');
    expect(within(select).getByRole('option', { name: 'CE — Ceibo' })).toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: /Quebracho/ })).not.toBeInTheDocument();

    await usuario.selectOptions(select, 'sp-3');
    await usuario.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(await screen.findByRole('cell', { name: 'Ceibo' })).toBeInTheDocument();
    const insercion = consultas.find((consulta) => consulta.operacion === 'insert');
    expect(insercion?.tabla).toBe('plantation_species');
    expect(insercion?.payload).toEqual({
      plantation_id: 'plant-1',
      species_id: 'sp-3',
      orden_visual: 2,
    });
  });

  test('quitar una especie sin árboles pide confirmación y borra', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await screen.findByRole('cell', { name: 'Algarrobo' });

    await usuario.click(within(filaDe('Algarrobo')).getByRole('button', { name: 'Quitar' }));
    const dialogo = screen.getByRole('dialog', { name: 'Quitar especie' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Quitar' }));

    expect(screen.queryByRole('cell', { name: 'Algarrobo' })).not.toBeInTheDocument();
    const borrado = consultas.find((consulta) => consulta.operacion === 'delete');
    expect(borrado?.tabla).toBe('plantation_species');
    expect(borrado?.filtros).toEqual([
      { metodo: 'eq', columna: 'plantation_id', valor: 'plant-1' },
      { metodo: 'eq', columna: 'species_id', valor: 'sp-2' },
    ]);
  });

  test('subir una especie intercambia su orden con la vecina', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    await screen.findByRole('cell', { name: 'Algarrobo' });

    expect(screen.getByRole('button', { name: 'Subir Quebracho' })).toBeDisabled();
    await usuario.click(screen.getByRole('button', { name: 'Subir Algarrobo' }));

    const updates = consultas.filter(
      (consulta) => consulta.tabla === 'plantation_species' && consulta.operacion === 'update',
    );
    expect(updates).toHaveLength(2);
    expect(updates[0].payload).toEqual({ orden_visual: 0 });
    expect(updates[1].payload).toEqual({ orden_visual: 1 });
  });
});

describe('sección GPS', () => {
  function consultasUpdatePlantations(): ConsultaCapturada[] {
    return consultas.filter(
      (consulta) => consulta.tabla === 'plantations' && consulta.operacion === 'update',
    );
  }

  test('guarda frecuencia y obligatoriedad cuando hay cambios válidos', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    const frecuencia = await screen.findByLabelText('Frecuencia de captura (cada N árboles)');

    // Sin cambios el botón queda deshabilitado.
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    await usuario.clear(frecuencia);
    await usuario.type(frecuencia, '5');
    await usuario.click(screen.getByLabelText('Captura obligatoria'));
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(consultasUpdatePlantations()).toHaveLength(1);
    expect(consultasUpdatePlantations()[0].payload).toEqual({
      gps_capture_frequency: 5,
      gps_capture_required: false,
    });
  });

  test('frecuencia inválida muestra el error y no toca la base', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    const frecuencia = await screen.findByLabelText('Frecuencia de captura (cada N árboles)');

    await usuario.clear(frecuencia);
    await usuario.type(frecuencia, '0');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByText('La frecuencia debe ser un número entero de al menos 1'),
    ).toBeInTheDocument();
    expect(consultasUpdatePlantations()).toHaveLength(0);
  });

  test('si falta la migración 023 muestra el mensaje y no rompe', async () => {
    const usuario = userEvent.setup();
    errorUpdatePlantations = {
      message: 'column "gps_capture_frequency" does not exist',
      code: PG_ERROR.UNDEFINED_COLUMN,
    };
    renderRutasEn('/plantaciones/plant-1/configuracion');
    const frecuencia = await screen.findByLabelText('Frecuencia de captura (cada N árboles)');

    await usuario.clear(frecuencia);
    await usuario.type(frecuencia, '5');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(MENSAJE_GPS_SIN_MIGRACION)).toBeInTheDocument();
  });
});

describe('sección Visibilidad', () => {
  test('guarda al cambiar y refleja el nuevo estado en el checkbox', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/configuracion');
    const checkbox = await screen.findByLabelText('Visible para técnicos en la app');
    expect(checkbox).toBeChecked();

    await usuario.click(checkbox);

    const update = consultas.find(
      (consulta) => consulta.tabla === 'plantations' && consulta.operacion === 'update',
    );
    expect(update?.payload).toEqual({ visible_in_app: false });
    // La invalidación de ['plantacion', id] refetchea el detalle; el toggle
    // queda en el nuevo estado (oculta).
    await waitFor(() => expect(checkbox).not.toBeChecked());
  });

  test('si el update falla hace rollback visual del checkbox', async () => {
    const usuario = userEvent.setup();
    errorUpdatePlantations = { message: 'sin permisos' };
    renderRutasEn('/plantaciones/plant-1/configuracion');
    const checkbox = await screen.findByLabelText('Visible para técnicos en la app');

    await usuario.click(checkbox);

    expect(await screen.findByText('No se pudo actualizar la visibilidad.')).toBeInTheDocument();
    expect(checkbox).toBeChecked();
  });

  test('si falta la migración 024 muestra el mensaje de migración', async () => {
    const usuario = userEvent.setup();
    errorUpdatePlantations = {
      message: 'column "visible_in_app" does not exist',
      code: PG_ERROR.UNDEFINED_COLUMN,
    };
    renderRutasEn('/plantaciones/plant-1/configuracion');
    const checkbox = await screen.findByLabelText('Visible para técnicos en la app');

    await usuario.click(checkbox);

    expect(await screen.findByText(MENSAJE_VISIBILIDAD_SIN_MIGRACION)).toBeInTheDocument();
  });
});
