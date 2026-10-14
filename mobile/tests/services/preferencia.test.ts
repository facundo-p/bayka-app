// Preferencia local genérica (SecureStore): hidratación y escritura.
import * as SecureStore from 'expo-secure-store';

import { crearPreferencia } from '../../src/services/settings/preferencia';

const crear = () =>
  crearPreferencia<number>({ clave: 'numero', porDefecto: 1, leer: Number, escribir: String });

describe('crearPreferencia', () => {
  beforeEach(() => jest.clearAllMocks());

  it('hidrata con el valor guardado, leído con su parser', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('7');
    const preferencia = crear();
    await preferencia.hydrate();
    expect(preferencia.get()).toBe(7);
  });

  it('persiste con su serializador', async () => {
    await crear().set(5);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('numero', '5');
  });

  it('lo elegido mientras se leía no lo pisa el valor guardado antes', async () => {
    let devolver: (valor: string) => void = () => {};
    (SecureStore.getItemAsync as jest.Mock).mockReturnValue(new Promise((resolve) => { devolver = resolve; }));
    const preferencia = crear();
    const hidratando = preferencia.hydrate();
    await preferencia.set(9);
    devolver('3');
    await hidratando;
    expect(preferencia.get()).toBe(9);
  });

  it('si no puede leer el almacenamiento queda el default', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('keystore'));
    const preferencia = crear();
    await expect(preferencia.hydrate()).resolves.toBeUndefined();
    expect(preferencia.get()).toBe(1);
  });
});
