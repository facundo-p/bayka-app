import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PERFIL_ADMIN, estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import { renderRutasEn } from '../../test/renderConRutas';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

const FILA_PLANTACION = {
  id: 'plant-1',
  lugar: 'Mendoza',
  periodo: '2025-2026',
  estado: 'activa',
  created_at: '2026-06-12T12:00:00Z',
  visible_in_app: false,
};

const PERFILES = [
  { id: 'user-2', nombre: 'Beto Técnico', rol: 'tecnico' },
  { id: 'user-3', nombre: 'Carla Campo', rol: 'admin' },
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
    if (consulta.tabla === 'plantations') {
      const filtroId = consulta.filtros.find((filtro) => filtro.columna === 'id');
      return { data: filtroId?.valor === FILA_PLANTACION.id ? FILA_PLANTACION : null };
    }
    if (consulta.tabla === 'profiles') return { data: PERFILES };
    if (consulta.tabla === 'plantation_users') return resolverPlantationUsers(consulta);
    return { data: [], count: 0 };
  };
}

beforeEach(() => {
  resetEstadoMock();
  estadoMock.sesion = { user: { id: 'user-1' } };
  estadoMock.perfilFila = PERFIL_ADMIN;
  asignadas = [filaAsignada('user-2', 'tecnico')];
  consultas = [];
  configurarDetalleMock();
});

test('muestra encabezado con badges y las tabs navegan entre sub-rutas', async () => {
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones/plant-1');

  expect(await screen.findByRole('heading', { name: 'Mendoza — 2025-2026' })).toBeInTheDocument();
  expect(screen.getByText('Activa')).toBeInTheDocument();
  expect(screen.getByText('Oculta en app')).toBeInTheDocument();
  // La tab index (Dashboard) es la activa por defecto.
  expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();

  await usuario.click(screen.getByRole('link', { name: 'Datos' }));
  expect(screen.getByRole('heading', { name: 'Datos' })).toBeInTheDocument();

  await usuario.click(screen.getByRole('link', { name: 'Configuración' }));
  expect(await screen.findByRole('heading', { name: 'Usuarios asignados' })).toBeInTheDocument();
});

test('plantación inexistente muestra el estado vacío con link al listado', async () => {
  renderRutasEn('/plantaciones/no-existe');

  expect(await screen.findByText('Plantación no encontrada')).toBeInTheDocument();
  const volver = screen.getByRole('link', { name: /Volver a plantaciones/ });
  expect(volver).toHaveAttribute('href', '/plantaciones');
});

test('asigna un usuario disponible y la tabla se actualiza', async () => {
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones/plant-1/configuracion');

  expect(await screen.findByRole('cell', { name: 'Beto Técnico' })).toBeInTheDocument();
  await usuario.selectOptions(screen.getByLabelText('Usuario'), 'user-3');
  await usuario.click(screen.getByRole('button', { name: 'Asignar' }));

  expect(await screen.findByRole('cell', { name: 'Carla Campo' })).toBeInTheDocument();
  const insercion = consultas.find((consulta) => consulta.operacion === 'insert');
  expect(insercion?.tabla).toBe('plantation_users');
  expect(insercion?.payload).toEqual({
    plantation_id: 'plant-1',
    user_id: 'user-3',
    rol_en_plantacion: 'tecnico',
  });
  // El select vuelve al placeholder: el botón queda deshabilitado.
  expect(screen.getByRole('button', { name: 'Asignar' })).toBeDisabled();
});

test('el select de usuarios no lista a los ya asignados', async () => {
  renderRutasEn('/plantaciones/plant-1/configuracion');

  const select = await screen.findByLabelText('Usuario');
  expect(within(select).getByRole('option', { name: 'Carla Campo' })).toBeInTheDocument();
  expect(within(select).queryByRole('option', { name: 'Beto Técnico' })).not.toBeInTheDocument();
});

test('quitar pide confirmación, cancela sin borrar y confirma borrando', async () => {
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones/plant-1/configuracion');
  await screen.findByRole('cell', { name: 'Beto Técnico' });

  // Cancelar: la fila sigue y no hubo delete.
  await usuario.click(screen.getByRole('button', { name: 'Quitar' }));
  let dialogo = screen.getByRole('dialog', { name: 'Quitar usuario' });
  expect(dialogo).toHaveTextContent('Beto Técnico dejará de ver esta plantación en la app.');
  expect(dialogo).toHaveTextContent('Sus árboles registrados se conservan.');
  await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(consultas.some((consulta) => consulta.operacion === 'delete')).toBe(false);

  // Confirmar: borra la fila y la tabla queda vacía.
  await usuario.click(screen.getByRole('button', { name: 'Quitar' }));
  dialogo = screen.getByRole('dialog', { name: 'Quitar usuario' });
  await usuario.click(within(dialogo).getByRole('button', { name: 'Quitar' }));

  expect(await screen.findByText(/Sin usuarios asignados/)).toBeInTheDocument();
  const borrado = consultas.find((consulta) => consulta.operacion === 'delete');
  expect(borrado?.tabla).toBe('plantation_users');
  expect(borrado?.filtros).toEqual([
    { metodo: 'eq', columna: 'plantation_id', valor: 'plant-1' },
    { metodo: 'eq', columna: 'user_id', valor: 'user-2' },
  ]);
});
