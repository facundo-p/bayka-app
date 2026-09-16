// Permisos sobre el grupo en el detalle de plantación (#469): una plantación
// finalizada es inmutable, así que no se edita ni se borra ninguno de sus grupos.

jest.mock('../../src/database/liveQuery', () => ({
  useLiveData: jest.fn(),
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/repositories/GroupRepository', () => ({
  deleteGroup: jest.fn(),
  updateGroup: jest.fn(),
  updateGroupCode: jest.fn(),
}));

jest.mock('../../src/queries/plantationDetailQueries', () => ({
  getPlantationLugar: jest.fn(),
  getGroupsForPlantation: jest.fn(),
  getNNCountsPerGroup: jest.fn(),
  getTreeCountsPerGroup: jest.fn(),
}));

jest.mock('../../src/queries/adminQueries', () => ({ getPlantationEstado: jest.fn() }));
jest.mock('../../src/repositories/ParcelaRepository', () => ({ findById: jest.fn() }));
jest.mock('../../src/hooks/useCurrentUserId', () => ({ useCurrentUserId: jest.fn() }));
jest.mock('../../src/hooks/useUserNames', () => ({ useUserNames: jest.fn().mockReturnValue({}) }));
jest.mock('../../src/hooks/useConfirm', () => ({
  useConfirm: jest.fn().mockReturnValue({ confirmProps: {}, show: jest.fn() }),
}));
jest.mock('../../src/utils/alertHelpers', () => ({ showDoubleConfirmDialog: jest.fn() }));

const { useLiveData } = require('../../src/database/liveQuery');
const { deleteGroup, updateGroup } = require('../../src/repositories/GroupRepository');
const { useCurrentUserId } = require('../../src/hooks/useCurrentUserId');
const { showDoubleConfirmDialog } = require('../../src/utils/alertHelpers');

import { renderHook, act } from '@testing-library/react-native';
import { usePlantationDetail } from '../../src/hooks/usePlantationDetail';

const GRUPO = {
  id: 'g-1',
  plantacionId: 'p-1',
  parcelaId: 'par-1',
  nombre: 'Grupo 1',
  codigo: 'G1',
  tipo: 'linea',
  estado: 'activa',
  usuarioCreador: 'user-1',
} as any;

/** `estadoCargado: false` simula la ventana en la que la query todavía no resolvió. */
function mockLiveQueries({ grupos = [GRUPO], plantacionEstado = 'activa', estadoCargado = true } = {}) {
  (useLiveData as jest.Mock).mockImplementation((queryFn: () => unknown) => {
    const fuente = String(queryFn);
    if (fuente.includes('getGroupsForPlantation')) return { data: grupos };
    if (fuente.includes('getPlantationEstado')) {
      return { data: estadoCargado ? [{ estado: plantacionEstado }] : undefined };
    }
    return { data: [] };
  });
}

function render() {
  return renderHook(() => usePlantationDetail('p-1', 'par-1')).result;
}

describe('usePlantationDetail — permisosDeGrupo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useCurrentUserId as jest.Mock).mockReturnValue('user-1');
    (updateGroup as jest.Mock).mockResolvedValue({ success: true });
    mockLiveQueries();
  });

  it('plantación activa + grupo activo + creador → puede editar y eliminar', () => {
    const result = render();

    expect(result.current.permisosDeGrupo(GRUPO)).toEqual({
      canEdit: true, canDelete: true, canReactivate: false,
    });
  });

  // El agujero de #469: el tacho de borrar solo miraba al creador y al estado del
  // grupo, nunca al de la plantación.
  it('plantación finalizada → no puede eliminar aunque el grupo esté activo y sea suyo', () => {
    mockLiveQueries({ plantacionEstado: 'finalizada' });

    expect(render().current.permisosDeGrupo(GRUPO).canDelete).toBe(false);
  });

  it('plantación finalizada → tampoco puede editar', () => {
    mockLiveQueries({ plantacionEstado: 'finalizada' });

    expect(render().current.permisosDeGrupo(GRUPO).canEdit).toBe(false);
  });

  it('grupo de otro usuario → no puede eliminar', () => {
    (useCurrentUserId as jest.Mock).mockReturnValue('user-2');

    expect(render().current.permisosDeGrupo(GRUPO).canDelete).toBe(false);
  });

  // Mientras el estado no cargó, permitir y corregir después deja una ventana para
  // un toque temprano sobre una plantación que resulta estar finalizada.
  it('estado de plantación sin cargar → ningún permiso', () => {
    mockLiveQueries({ estadoCargado: false });

    expect(render().current.permisosDeGrupo(GRUPO)).toEqual({
      canEdit: false, canDelete: false, canReactivate: false,
    });
  });

  it('la guarda está en el handler: sin permiso no abre ni el diálogo', () => {
    mockLiveQueries({ plantacionEstado: 'finalizada' });

    render().current.handleDeleteGroup(GRUPO);

    expect(showDoubleConfirmDialog).not.toHaveBeenCalled();
    expect(deleteGroup).not.toHaveBeenCalled();
  });

  it('con permiso sí abre el diálogo de confirmación', () => {
    render().current.handleDeleteGroup(GRUPO);

    expect(showDoubleConfirmDialog).toHaveBeenCalled();
  });

  // El modal de edición pudo quedar abierto mientras un pull finalizaba la
  // plantación: el que escribe es el submit, no el que abre.
  it('handleEditSubmit no escribe si la plantación se finalizó con el modal abierto', async () => {
    const { result, rerender } = renderHook(() => usePlantationDetail('p-1', 'par-1'));

    act(() => result.current.handleLongPress(GRUPO));
    expect(result.current.editingGroup).toEqual(GRUPO);

    mockLiveQueries({ plantacionEstado: 'finalizada' });
    rerender(undefined);

    await act(async () => { await result.current.handleEditSubmit({ nombre: 'X', codigo: 'X1', tipo: 'linea' as any }); });

    expect(updateGroup).not.toHaveBeenCalled();
  });

  it('handleEditSubmit sí escribe con la plantación activa', async () => {
    const result = render();

    act(() => result.current.handleLongPress(GRUPO));
    await act(async () => { await result.current.handleEditSubmit({ nombre: 'X', codigo: 'X1', tipo: 'linea' as any }); });

    expect(updateGroup).toHaveBeenCalled();
  });

  it('handleLongPress abre la edición con la plantación activa', () => {
    const result = render();

    act(() => result.current.handleLongPress(GRUPO));

    expect(result.current.editingGroup).toEqual(GRUPO);
  });

  it('handleLongPress no abre la edición sobre una plantación finalizada', () => {
    mockLiveQueries({ plantacionEstado: 'finalizada' });
    const result = render();

    act(() => result.current.handleLongPress(GRUPO));

    expect(result.current.editingGroup).toBeNull();
  });
});
