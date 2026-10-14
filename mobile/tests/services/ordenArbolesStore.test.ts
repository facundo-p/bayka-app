// Tests de la preferencia global de orden del listado de árboles (SecureStore).
import * as SecureStore from 'expo-secure-store';

import { preferenciaOrdenDescendente } from '../../src/services/settings/ordenArbolesStore';

const KEY = 'orden_arboles_descendente';

describe('ordenArbolesStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    preferenciaOrdenDescendente.reset();
  });

  it('por defecto es ascendente (no descendente)', () => {
    expect(preferenciaOrdenDescendente.get()).toBe(false);
  });

  it('hidrata el descendente guardado', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');
    await preferenciaOrdenDescendente.hydrate();
    expect(preferenciaOrdenDescendente.get()).toBe(true);
  });

  it('set persiste en SecureStore y notifica', async () => {
    const listener = jest.fn();
    preferenciaOrdenDescendente.subscribe(listener);
    await preferenciaOrdenDescendente.set(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(KEY, 'true');
    expect(listener).toHaveBeenCalledWith(true);
  });
});
