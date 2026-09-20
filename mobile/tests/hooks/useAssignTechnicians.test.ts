// El hook de AssignTechniciansScreen: de dónde saca la organización, qué pasa
// sin conexión, y el aviso al desasignar a alguien con grupos sin subir (#546).
import { renderHook, act, waitFor } from '@testing-library/react-native';

jest.mock('../../src/queries/adminQueries', () => ({
  getTechniciansWithAssignment: jest.fn(),
  getTechnicianUnsyncedGroupCount: jest.fn(),
}));

jest.mock('../../src/repositories/PlantationRepository', () => ({
  assignTechnicians: jest.fn(),
}));

jest.mock('../../src/hooks/useProfileData', () => ({
  useProfileData: jest.fn(),
}));

jest.mock('../../src/hooks/useConfirm', () => ({
  useConfirm: jest.fn().mockReturnValue({ confirmProps: {}, show: jest.fn() }),
}));

jest.mock('../../src/utils/alertHelpers', () => ({
  showInfoDialog: jest.fn(),
  showConfirmDialog: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({ fetch: jest.fn() }));

import NetInfo from '@react-native-community/netinfo';
import {
  getTechniciansWithAssignment,
  getTechnicianUnsyncedGroupCount,
} from '../../src/queries/adminQueries';
import { assignTechnicians } from '../../src/repositories/PlantationRepository';
import { useProfileData } from '../../src/hooks/useProfileData';
import { showConfirmDialog } from '../../src/utils/alertHelpers';
import { useAssignTechnicians, mensajeDeDesasignacion } from '../../src/hooks/useAssignTechnicians';

const TECNICOS = [
  { id: 'tec-1', nombre: 'Ana', assigned: true },
  { id: 'tec-2', nombre: 'Bruno', assigned: false },
];

beforeEach(() => {
  jest.clearAllMocks();
  (useProfileData as jest.Mock).mockReturnValue({ profile: { organizacionId: 'org-1' } });
  (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
  (getTechniciansWithAssignment as jest.Mock).mockResolvedValue(TECNICOS);
  (getTechnicianUnsyncedGroupCount as jest.Mock).mockResolvedValue(0);
});

async function montar(plantacionId: string | undefined = 'plant-1') {
  const vista = renderHook(() => useAssignTechnicians(plantacionId));
  await waitFor(() => expect(vista.result.current.loading).toBe(false));
  return vista;
}

describe('useAssignTechnicians', () => {
  it('toma la organización del perfil, sin consultar Supabase por su cuenta', async () => {
    const { result } = await montar();

    expect(getTechniciansWithAssignment).toHaveBeenCalledWith('org-1', 'plant-1');
    expect(result.current.items).toEqual(TECNICOS);
    expect(result.current.assignedCount).toBe(1);
  });

  it('sin organización en el perfil no consulta nada', async () => {
    (useProfileData as jest.Mock).mockReturnValue({ profile: null });

    renderHook(() => useAssignTechnicians('plant-1'));

    await waitFor(() => expect(getTechniciansWithAssignment).not.toHaveBeenCalled());
  });

  it('sin conexión avisa y no deja la pantalla cargando para siempre', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });

    const { result } = await montar();

    expect(result.current.networkError).toBe(true);
    expect(getTechniciansWithAssignment).not.toHaveBeenCalled();
  });

  it('asignar no pregunta nada', async () => {
    const { result } = await montar();

    await act(() => result.current.handleToggle('tec-2', true));

    expect(showConfirmDialog).not.toHaveBeenCalled();
    expect(result.current.items[1].assigned).toBe(true);
  });

  it('desasignar sin grupos pendientes tampoco pregunta', async () => {
    const { result } = await montar();

    await act(() => result.current.handleToggle('tec-1', false));

    expect(showConfirmDialog).not.toHaveBeenCalled();
    expect(result.current.items[0].assigned).toBe(false);
  });

  it('desasignar con grupos pendientes pide confirmación y recién ahí desmarca', async () => {
    (getTechnicianUnsyncedGroupCount as jest.Mock).mockResolvedValue(2);
    const { result } = await montar();

    await act(() => result.current.handleToggle('tec-1', false));

    expect(showConfirmDialog).toHaveBeenCalledWith(
      expect.anything(),
      'Técnico con grupos pendientes',
      mensajeDeDesasignacion(2),
      'Desasignar',
      expect.any(Function),
      expect.objectContaining({ style: 'danger' }),
    );
    expect(result.current.items[0].assigned).toBe(true);

    const confirmar = (showConfirmDialog as jest.Mock).mock.calls[0][4];
    act(() => confirmar());
    expect(result.current.items[0].assigned).toBe(false);
  });

  it('guarda solo los ids marcados', async () => {
    const { result } = await montar();

    await act(() => result.current.handleToggle('tec-2', true));
    await act(() => result.current.handleSave());

    expect(assignTechnicians).toHaveBeenCalledWith('plant-1', ['tec-1', 'tec-2']);
  });
});

describe('mensajeDeDesasignacion', () => {
  it('singular', () => {
    expect(mensajeDeDesasignacion(1)).toContain('1 grupo sin sincronizar');
  });

  it('plural', () => {
    expect(mensajeDeDesasignacion(3)).toContain('3 grupos sin sincronizar');
  });
});
