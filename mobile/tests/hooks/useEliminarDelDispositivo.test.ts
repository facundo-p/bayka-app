// "Eliminar del dispositivo" lee todo de SQLite: tiene que andar aunque la plantación
// ya no esté en el catálogo del server (#478).

jest.mock('../../src/queries/catalogQueries', () => ({
  getPlantacionParaEliminarDelDispositivo: jest.fn(),
  getResumenDePendientes: jest.fn(),
}));
jest.mock('../../src/repositories/PlantationRepository', () => ({
  deletePlantationLocally: jest.fn().mockResolvedValue(undefined),
}));

import { renderHook } from '@testing-library/react-native';
import { useEliminarDelDispositivo } from '../../src/hooks/useEliminarDelDispositivo';
import { getPlantacionParaEliminarDelDispositivo, getResumenDePendientes } from '../../src/queries/catalogQueries';
import { deletePlantationLocally } from '../../src/repositories/PlantationRepository';

const SIN_PENDIENTES = { activaCount: 0, finalizadaCount: 0, parcelas: 0, fotos: 0, borrados: 0 };

function confirmarTodo(show: jest.Mock) {
  // Aprieta el último botón de cada diálogo, incluida la segunda confirmación.
  for (let i = 0; i < show.mock.calls.length; i++) {
    const { buttons } = show.mock.calls[i][0];
    buttons[buttons.length - 1].onPress();
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  (getResumenDePendientes as jest.Mock).mockResolvedValue(SIN_PENDIENTES);
});

describe('useEliminarDelDispositivo', () => {
  it('eliminada en el server y fuera del catálogo: igual ofrece eliminarla y la borra', async () => {
    (getPlantacionParaEliminarDelDispositivo as jest.Mock).mockResolvedValue({
      lugar: 'Norte', eliminadaEnServidorEn: '2026-09-17T12:00:00.000Z',
    });
    const show = jest.fn();
    const { result } = renderHook(() => useEliminarDelDispositivo(show));

    await result.current('p-1');

    expect(show).toHaveBeenCalledWith(expect.objectContaining({ title: 'Eliminar del dispositivo' }));
    expect(show.mock.calls[0][0].message).toContain('eliminada en el servidor');
    confirmarTodo(show);
    expect(deletePlantationLocally).toHaveBeenCalledWith('p-1');
  });

  it('con pendientes pide doble confirmación antes de borrar', async () => {
    (getPlantacionParaEliminarDelDispositivo as jest.Mock).mockResolvedValue({ lugar: 'Norte', eliminadaEnServidorEn: null });
    (getResumenDePendientes as jest.Mock).mockResolvedValue({ ...SIN_PENDIENTES, fotos: 2 });
    const show = jest.fn();
    const { result } = renderHook(() => useEliminarDelDispositivo(show));

    await result.current('p-1');
    const { buttons } = show.mock.calls[0][0];
    buttons[buttons.length - 1].onPress();

    expect(show).toHaveBeenCalledTimes(2);
    expect(deletePlantationLocally).not.toHaveBeenCalled();
    confirmarTodo(show);
    expect(deletePlantationLocally).toHaveBeenCalledWith('p-1');
  });

  it('si la plantación no está local no muestra nada', async () => {
    (getPlantacionParaEliminarDelDispositivo as jest.Mock).mockResolvedValue(null);
    const show = jest.fn();
    const { result } = renderHook(() => useEliminarDelDispositivo(show));

    await result.current('p-1');

    expect(show).not.toHaveBeenCalled();
  });
});
