// El hook de AssignTechniciansScreen: de dónde saca la organización, que funciona
// sin conexión salvo para quitar (#636), y el aviso al desasignar a alguien con
// grupos sin subir (#546).
import { renderHook, act, waitFor } from '@testing-library/react-native';

jest.mock('../../src/queries/adminQueries', () => ({
  getTechniciansWithAssignment: jest.fn(),
  getTechnicianUnsyncedGroupCount: jest.fn(),
}));

jest.mock('../../src/services/TecnicosDePlantacionService', () => ({
  guardarTecnicosDePlantacion: jest.fn(),
  refrescarTecnicosDeOrganizacion: jest.fn(),
}));

jest.mock('../../src/hooks/useProfileData', () => ({
  useProfileData: jest.fn(),
}));

jest.mock('../../src/hooks/useNetStatus', () => ({
  useNetStatus: jest.fn(),
}));

jest.mock('../../src/hooks/useConfirm', () => ({
  useConfirm: jest.fn().mockReturnValue({ confirmProps: {}, show: jest.fn() }),
}));

jest.mock('../../src/utils/alertHelpers', () => ({
  showInfoDialog: jest.fn(),
  showConfirmDialog: jest.fn(),
}));

import {
  getTechniciansWithAssignment,
  getTechnicianUnsyncedGroupCount,
} from '../../src/queries/adminQueries';
import {
  guardarTecnicosDePlantacion,
  refrescarTecnicosDeOrganizacion,
} from '../../src/services/TecnicosDePlantacionService';
import { useProfileData } from '../../src/hooks/useProfileData';
import { useNetStatus } from '../../src/hooks/useNetStatus';
import { showConfirmDialog, showInfoDialog } from '../../src/utils/alertHelpers';
import { useAssignTechnicians, mensajeDeDesasignacion } from '../../src/hooks/useAssignTechnicians';

const TECNICOS = [
  { id: 'tec-1', nombre: 'Ana', assigned: true, pendiente: false },
  { id: 'tec-3', nombre: 'Carla', assigned: true, pendiente: true },
  { id: 'tec-2', nombre: 'Bruno', assigned: false, pendiente: false },
];

beforeEach(() => {
  jest.clearAllMocks();
  (useProfileData as jest.Mock).mockReturnValue({ profile: { organizacionId: 'org-1' } });
  (useNetStatus as jest.Mock).mockReturnValue({ isOnline: true });
  (getTechniciansWithAssignment as jest.Mock).mockResolvedValue(TECNICOS);
  (getTechnicianUnsyncedGroupCount as jest.Mock).mockResolvedValue(0);
  (guardarTecnicosDePlantacion as jest.Mock).mockResolvedValue([]);
});

async function montar(plantacionId: string | undefined = 'plant-1') {
  const vista = renderHook(() => useAssignTechnicians(plantacionId));
  await waitFor(() => expect(vista.result.current.loading).toBe(false));
  return vista;
}

const item = (result: any, id: string) => result.current.items.find((t: any) => t.id === id);

describe('useAssignTechnicians', () => {
  it('refresca el caché y lee los técnicos de la organización del perfil', async () => {
    const { result } = await montar();

    expect(refrescarTecnicosDeOrganizacion).toHaveBeenCalled();
    expect(getTechniciansWithAssignment).toHaveBeenCalledWith('org-1', 'plant-1');
    expect(result.current.items).toEqual(TECNICOS);
    expect(result.current.assignedCount).toBe(2);
  });

  it('sin organización en el perfil no consulta nada', async () => {
    (useProfileData as jest.Mock).mockReturnValue({ profile: null });

    renderHook(() => useAssignTechnicians('plant-1'));

    await waitFor(() => expect(getTechniciansWithAssignment).not.toHaveBeenCalled());
  });

  it('sin conexión carga igual y se puede asignar', async () => {
    (useNetStatus as jest.Mock).mockReturnValue({ isOnline: false });
    const { result } = await montar();

    await act(() => result.current.handleToggle('tec-2', true));

    expect(result.current.sinConexion).toBe(true);
    expect(item(result, 'tec-2').assigned).toBe(true);
  });

  it('sin conexión no se quita a un técnico asignado en el servidor', async () => {
    (useNetStatus as jest.Mock).mockReturnValue({ isOnline: false });
    const { result } = await montar();

    expect(result.current.puedeQuitar('tec-1')).toBe(false);
    await act(() => result.current.handleToggle('tec-1', false));

    expect(item(result, 'tec-1').assigned).toBe(true);
    expect(getTechnicianUnsyncedGroupCount).not.toHaveBeenCalled();
  });

  it('sin conexión sí se deshace un alta que todavía no subió', async () => {
    (useNetStatus as jest.Mock).mockReturnValue({ isOnline: false });
    const { result } = await montar();

    expect(result.current.puedeQuitar('tec-3')).toBe(true);
    await act(() => result.current.handleToggle('tec-3', false));

    expect(item(result, 'tec-3').assigned).toBe(false);
  });

  it('desasignar sin grupos pendientes no pregunta', async () => {
    const { result } = await montar();

    await act(() => result.current.handleToggle('tec-1', false));

    expect(showConfirmDialog).not.toHaveBeenCalled();
    expect(item(result, 'tec-1').assigned).toBe(false);
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
    expect(item(result, 'tec-1').assigned).toBe(true);

    const confirmar = (showConfirmDialog as jest.Mock).mock.calls[0][4];
    act(() => confirmar());
    expect(item(result, 'tec-1').assigned).toBe(false);
  });

  it('guarda solo lo que cambió, como altas y bajas, y cierra', async () => {
    const onClose = jest.fn();
    const { result } = await montar();

    await act(() => result.current.handleToggle('tec-2', true));
    await act(() => result.current.handleToggle('tec-1', false));
    await act(() => result.current.handleSave(onClose));

    expect(guardarTecnicosDePlantacion).toHaveBeenCalledWith('plant-1', { altas: ['tec-2'], bajas: ['tec-1'] });
    expect(onClose).toHaveBeenCalled();
  });

  it('técnicos que el servidor no asignó: recarga, avisa y no cierra', async () => {
    (guardarTecnicosDePlantacion as jest.Mock).mockResolvedValue(['Bruno']);
    const onClose = jest.fn();
    const { result } = await montar();

    await act(() => result.current.handleToggle('tec-2', true));
    await act(() => result.current.handleSave(onClose));

    expect(onClose).not.toHaveBeenCalled();
    expect(getTechniciansWithAssignment).toHaveBeenCalledTimes(2);
    expect(showInfoDialog).toHaveBeenCalledWith(
      expect.anything(), 'Técnicos no asignados', expect.stringContaining('Bruno'), expect.anything(), expect.anything(),
    );
  });

  it('un error al guardar recarga y lo muestra', async () => {
    (guardarTecnicosDePlantacion as jest.Mock).mockRejectedValue(new Error('La plantación está archivada.'));
    const { result } = await montar();

    await act(() => result.current.handleToggle('tec-2', true));
    await act(() => result.current.handleSave(jest.fn()));

    expect(showInfoDialog).toHaveBeenCalledWith(
      expect.anything(), 'Error', 'La plantación está archivada.', expect.anything(), expect.anything(),
    );
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
