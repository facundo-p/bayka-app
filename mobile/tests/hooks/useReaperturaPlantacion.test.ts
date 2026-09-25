jest.mock('@react-native-community/netinfo', () => ({ fetch: jest.fn() }));

jest.mock('../../src/repositories/PlantationRepository', () => {
  class ReabrirPlantacionLocalSyncError extends Error {}
  return { reabrirPlantacion: jest.fn(), ReabrirPlantacionLocalSyncError };
});

jest.mock('../../src/utils/alertHelpers', () => ({ showInfoDialog: jest.fn() }));

import NetInfo from '@react-native-community/netinfo';
import { renderHook } from '@testing-library/react-native';
import { useReaperturaPlantacion } from '../../src/hooks/useReaperturaPlantacion';
import { reabrirPlantacion, ReabrirPlantacionLocalSyncError } from '../../src/repositories/PlantationRepository';
import { showInfoDialog } from '../../src/utils/alertHelpers';
import type { Plantation } from '../../src/types/plantation';

const FINALIZADA: Plantation = {
  id: 'p1',
  lugar: 'Finca Norte',
  periodo: '2026-A',
  estado: 'finalizada',
  createdAt: '2026-01-01',
  archivadaEn: null,
  eliminadaEnServidorEn: null,
};

function montar() {
  const show = jest.fn();
  const { result } = renderHook(() => useReaperturaPlantacion(show));
  return { show, handleReopen: result.current.handleReopen };
}

function confirmar(show: jest.Mock) {
  const botones = show.mock.calls[0][0].buttons;
  return botones.find((b: { label: string }) => b.label === 'Reabrir').onPress();
}

describe('useReaperturaPlantacion (#637)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
  });

  it('online: confirma con el texto de la web y al aceptar reabre', async () => {
    const { show, handleReopen } = montar();

    await handleReopen(FINALIZADA);

    expect(show).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Reabrir Finca Norte?' }));
    expect(reabrirPlantacion).not.toHaveBeenCalled();
    await confirmar(show);
    expect(reabrirPlantacion).toHaveBeenCalledWith('p1');
  });

  it('sin conexión: avisa y no pide confirmación', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
    const { show, handleReopen } = montar();

    await handleReopen(FINALIZADA);

    expect(show).not.toHaveBeenCalled();
    expect(showInfoDialog).toHaveBeenCalledWith(show, 'Sin conexión', expect.any(String), 'wifi-outline', expect.any(String));
  });

  it.each([
    ['conectado sin internet', { isConnected: true, isInternetReachable: false }],
    ['red desconocida', { isConnected: null, isInternetReachable: null }],
  ])('%s: avisa que no hay conexión (#652)', async (_caso, estado) => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue(estado);
    const { show, handleReopen } = montar();

    await handleReopen(FINALIZADA);

    expect(show).not.toHaveBeenCalled();
    expect(showInfoDialog).toHaveBeenCalledWith(show, 'Sin conexión', expect.any(String), 'wifi-outline', expect.any(String));
  });

  it('no hace nada sobre una plantación que no es reabrible', async () => {
    const { show, handleReopen } = montar();

    await handleReopen({ ...FINALIZADA, estado: 'activa' });

    expect(NetInfo.fetch).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
  });

  it('rechazo del server: muestra su mensaje', async () => {
    (reabrirPlantacion as jest.Mock).mockRejectedValue(new Error('Solo un superadmin puede reabrir una plantación.'));
    const { show, handleReopen } = montar();

    await handleReopen(FINALIZADA);
    await confirmar(show);

    expect(showInfoDialog).toHaveBeenCalledWith(show, 'No se pudo reabrir', 'Solo un superadmin puede reabrir una plantación.', 'alert-circle-outline', expect.any(String));
  });

  it('server ok pero SQLite falló: avisa que se actualiza en el próximo sync', async () => {
    (reabrirPlantacion as jest.Mock).mockRejectedValue(new ReabrirPlantacionLocalSyncError(new Error('SQLITE_BUSY')));
    const { show, handleReopen } = montar();

    await handleReopen(FINALIZADA);
    await confirmar(show);

    expect(showInfoDialog).toHaveBeenCalledWith(show, 'Plantación reabierta', expect.stringContaining('próxima sincronización'), 'cloud-done-outline', expect.any(String));
  });
});
