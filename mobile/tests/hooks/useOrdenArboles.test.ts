// Tests del hook de orden del listado de árboles.
import { act, renderHook } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { useOrdenArboles } from '../../src/hooks/useOrdenArboles';
import { preferenciaOrdenDescendente } from '../../src/services/settings/ordenArbolesStore';

describe('useOrdenArboles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    preferenciaOrdenDescendente.reset();
  });

  it('arranca ascendente', async () => {
    const { result } = renderHook(() => useOrdenArboles());
    await act(async () => {});
    expect(result.current.orden).toBe('asc');
  });

  it('alternar pasa a descendente, persiste y vuelve a ascendente', async () => {
    const { result } = renderHook(() => useOrdenArboles());
    await act(async () => { await result.current.alternar(); });
    expect(result.current.orden).toBe('desc');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('orden_arboles_descendente', 'true');
    await act(async () => { await result.current.alternar(); });
    expect(result.current.orden).toBe('asc');
  });

  it('dos consumidores comparten el valor', async () => {
    const a = renderHook(() => useOrdenArboles());
    const b = renderHook(() => useOrdenArboles());
    await act(async () => { await a.result.current.alternar(); });
    expect(b.result.current.orden).toBe('desc');
  });
});
