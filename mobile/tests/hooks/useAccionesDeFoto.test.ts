jest.mock('../../src/services/FotoExportService', () => ({
  asegurarFotoLocal: jest.fn(),
  guardarFotoEnGaleria: jest.fn(),
  compartirFoto: jest.fn(),
}));
jest.mock('../../src/utils/avisoBreve', () => ({ avisoBreve: jest.fn() }));
jest.mock('../../src/database/liveQuery', () => ({ notifyDataChanged: jest.fn() }));

import { act, renderHook } from '@testing-library/react-native';
import { useAccionesDeFoto } from '../../src/hooks/useAccionesDeFoto';
import { asegurarFotoLocal, guardarFotoEnGaleria } from '../../src/services/FotoExportService';
import { avisoBreve } from '../../src/utils/avisoBreve';

beforeEach(() => jest.clearAllMocks());

describe('useAccionesDeFoto', () => {
  it('si la acción lanza, avisa el error genérico y libera el botón', async () => {
    (asegurarFotoLocal as jest.Mock).mockResolvedValue({ ok: true, uri: 'file:///a.jpg', descargadaAhora: false });
    (guardarFotoEnGaleria as jest.Mock).mockRejectedValue(new Error('PermissionsException'));
    const { result } = renderHook(() => useAccionesDeFoto('file:///a.jpg', 't1'));
    await act(async () => {
      await result.current.guardar();
    });
    expect(avisoBreve).toHaveBeenCalledWith('No se pudo completar la acción. Probá de nuevo.');
    expect(result.current.ocupado).toBe(false);
  });

  it('si no se pudo tener la foto local, avisa el motivo sin ejecutar la acción', async () => {
    (asegurarFotoLocal as jest.Mock).mockResolvedValue({ ok: false, resultado: 'sin-conexion' });
    const { result } = renderHook(() => useAccionesDeFoto('plantacion/t1.jpg', 't1'));
    await act(async () => {
      await result.current.guardar();
    });
    expect(guardarFotoEnGaleria).not.toHaveBeenCalled();
    expect(avisoBreve).toHaveBeenCalledWith(expect.stringMatching(/^Sin conexión/));
  });

  it('avisa el éxito de guardar', async () => {
    (asegurarFotoLocal as jest.Mock).mockResolvedValue({ ok: true, uri: 'file:///a.jpg', descargadaAhora: false });
    (guardarFotoEnGaleria as jest.Mock).mockResolvedValue('guardada');
    const { result } = renderHook(() => useAccionesDeFoto('file:///a.jpg', 't1'));
    await act(async () => {
      await result.current.guardar();
    });
    expect(avisoBreve).toHaveBeenCalledWith('Guardada en el álbum Bayka');
  });
});
