// Preferencia "Descargar fotos de otros celulares" (#565) y migración del
// "Incluir fotos" anterior.
import * as SecureStore from 'expo-secure-store';

import { preferenciaDescargaDeFotos } from '../../src/services/settings/descargaDeFotosStore';

function conGuardado(valores: Record<string, string>) {
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (clave: string) => valores[clave] ?? null);
}

describe('preferenciaDescargaDeFotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    preferenciaDescargaDeFotos.reset();
  });

  it('por defecto descarga las fotos de otros celulares', async () => {
    conGuardado({});
    await preferenciaDescargaDeFotos.hydrate();
    expect(preferenciaDescargaDeFotos.get()).toBe(true);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('quien tenía "Incluir fotos" apagado sigue sin descargar, y la clave vieja se migra', async () => {
    conGuardado({ sync_include_photos: 'false' });
    await preferenciaDescargaDeFotos.hydrate();
    expect(preferenciaDescargaDeFotos.get()).toBe(false);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('descargar_fotos_de_otros', 'false');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('sync_include_photos');
  });

  it('quien tenía "Incluir fotos" prendido sigue descargando', async () => {
    conGuardado({ sync_include_photos: 'true' });
    await preferenciaDescargaDeFotos.hydrate();
    expect(preferenciaDescargaDeFotos.get()).toBe(true);
  });

  it('si ya existe la clave nueva, la vieja no se lee', async () => {
    conGuardado({ descargar_fotos_de_otros: 'true', sync_include_photos: 'false' });
    await preferenciaDescargaDeFotos.hydrate();
    expect(preferenciaDescargaDeFotos.get()).toBe(true);
    expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('cambiarla persiste en la clave nueva y avisa a Ajustes y al modal de sync', async () => {
    const listener = jest.fn();
    preferenciaDescargaDeFotos.subscribe(listener);
    await preferenciaDescargaDeFotos.set(false);
    expect(listener).toHaveBeenCalledWith(false);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('descargar_fotos_de_otros', 'false');
  });
});
