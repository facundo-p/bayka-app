// Hook del tamaño y orden de la botonera: por usuario, y sin usuario no se guarda nada.
import { act, renderHook } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { useEstiloBotonera } from '../../src/hooks/useEstiloBotonera';
import { useCurrentUserId } from '../../src/hooks/useCurrentUserId';
import { __resetEstiloBotoneraStore } from '../../src/services/settings/estiloBotoneraStore';

jest.mock('../../src/hooks/useCurrentUserId', () => ({ useCurrentUserId: jest.fn() }));

const ORIGINAL = { orden: 'codigo-arriba', tamanoCodigo: 18, tamanoNombre: 11 };
const ELEGIDO = { orden: 'nombre-arriba', tamanoCodigo: 12, tamanoNombre: 16 } as const;

describe('useEstiloBotonera', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetEstiloBotoneraStore();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  });

  it('con usuario, aplica y guarda en su clave', async () => {
    (useCurrentUserId as jest.Mock).mockReturnValue('u1');
    const { result } = renderHook(() => useEstiloBotonera());
    await act(async () => { result.current.setEstilo(ELEGIDO); });
    expect(result.current.estilo).toEqual(ELEGIDO);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('estilo_botonera_u1', JSON.stringify(ELEGIDO));
  });

  it('sin usuario todavía es el diseño original y no lee ni guarda nada', async () => {
    (useCurrentUserId as jest.Mock).mockReturnValue(null);
    const { result } = renderHook(() => useEstiloBotonera());
    await act(async () => { result.current.setEstilo(ELEGIDO); });
    expect(result.current.estilo).toEqual(ORIGINAL);
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('si no se puede guardar, el cambio vale igual en la sesión', async () => {
    (useCurrentUserId as jest.Mock).mockReturnValue('u1');
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keystore'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useEstiloBotonera());
    await act(async () => { result.current.setEstilo(ELEGIDO); });
    expect(result.current.estilo).toEqual(ELEGIDO);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
