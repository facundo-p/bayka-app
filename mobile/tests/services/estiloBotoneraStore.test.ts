// Tamaño y orden de la botonera (#744): preferencia por usuario en SecureStore.
import * as SecureStore from 'expo-secure-store';

import {
  __resetEstiloBotoneraStore,
  preferenciaEstiloBotonera,
} from '../../src/services/settings/estiloBotoneraStore';

const ORIGINAL = { orden: 'codigo-arriba', tamanoCodigo: 18, tamanoNombre: 11 };

describe('estiloBotoneraStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetEstiloBotoneraStore();
  });

  it('sin nada guardado es el diseño original', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    const preferencia = preferenciaEstiloBotonera('u1');
    await preferencia.hydrate();
    expect(preferencia.get()).toEqual(ORIGINAL);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('estilo_botonera_u1');
  });

  it('guarda y lee el estilo de cada usuario en su propia clave', async () => {
    const elegido = { orden: 'nombre-arriba', tamanoCodigo: 12, tamanoNombre: 16 } as const;
    await preferenciaEstiloBotonera('u1').set(elegido);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('estilo_botonera_u1', JSON.stringify(elegido));
    expect(preferenciaEstiloBotonera('u2').get()).toEqual(ORIGINAL);
  });

  it('hidrata lo guardado', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
      JSON.stringify({ orden: 'nombre-arriba', tamanoCodigo: 12, tamanoNombre: 16 }),
    );
    const preferencia = preferenciaEstiloBotonera('u1');
    await preferencia.hydrate();
    expect(preferencia.get()).toEqual({ orden: 'nombre-arriba', tamanoCodigo: 12, tamanoNombre: 16 });
  });

  it('un valor corrupto vuelve al diseño original', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('{no es json');
    const preferencia = preferenciaEstiloBotonera('u1');
    await preferencia.hydrate();
    expect(preferencia.get()).toEqual(ORIGINAL);
  });
});
