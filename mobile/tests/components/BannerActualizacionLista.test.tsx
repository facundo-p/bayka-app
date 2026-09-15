/**
 * El botón de reinicio aplica un OTA descargado, y `reloadAsync` se lleva el
 * estado en memoria: no puede aparecer habilitado mientras hay una sync escribiendo
 * en la base (#446).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import BannerActualizacionLista from '../../src/components/BannerActualizacionLista';
import { InsetSuperiorContexto } from '../../src/components/insetSuperior';
import {
  marcandoActividadDeSync,
  __resetActividadDeSync,
} from '../../src/services/sync/syncActivityStore';
import { spacing } from '../../src/theme';

const MOCK_INSET_TOP = 40;
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: MOCK_INSET_TOP, bottom: 24, left: 0, right: 0 }),
}));

// El componente no decide si se muestra —eso es de FranjasSuperiores—, pero sí
// aplica el inset superior cuando es el primero de la pila.
jest.mock('../../src/config/entorno', () => ({ ES_ENTORNO_DE_PRUEBAS: false }));

const mockReloadAsync = jest.fn();
jest.mock('expo-updates', () => ({
  reloadAsync: (...args: unknown[]) => mockReloadAsync(...args),
}));

const onDescartar = jest.fn();
// El provider es parte del contrato del componente: sin él nadie le cede el inset.
const renderBanner = () =>
  render(
    <InsetSuperiorContexto.Provider value={{ hayAvisoDeActualizacion: true }}>
      <BannerActualizacionLista onDescartar={onDescartar} />
    </InsetSuperiorContexto.Provider>,
  );

describe('BannerActualizacionLista', () => {
  beforeEach(() => {
    mockReloadAsync.mockReset().mockResolvedValue(undefined);
    onDescartar.mockReset();
    __resetActividadDeSync();
  });

  it('ofrece reiniciar', () => {
    const { getByTestId, getByText } = renderBanner();
    expect(getByTestId('banner-actualizacion-lista')).toBeTruthy();
    expect(getByText(/Hay una actualización lista/)).toBeTruthy();
  });

  it('ocupa el inset de la status bar: va arriba, no al pie', () => {
    const { getByTestId } = renderBanner();
    const estilo = StyleSheet.flatten(getByTestId('banner-actualizacion-lista').props.style);
    expect(estilo.paddingTop).toBe(MOCK_INSET_TOP + spacing.sm);
    // Exacto y no "< inset": con un >= laxo, volver a comerse el inset de la barra
    // de gestos pasaría el test.
    expect(estilo.paddingBottom).toBe(spacing.sm);
  });

  it('avisa que el reinicio cierra lo que el usuario esté haciendo', () => {
    const { getByText } = renderBanner();
    expect(getByText(/se cierra lo que estés haciendo/)).toBeTruthy();
  });

  it('el botón aplica el update', async () => {
    const { getByTestId } = renderBanner();
    fireEvent.press(getByTestId('banner-actualizacion-reiniciar'));
    await waitFor(() => expect(mockReloadAsync).toHaveBeenCalledTimes(1));
  });

  it('la ✕ avisa hacia arriba en vez de ocultarse sola', () => {
    const { getByTestId } = renderBanner();
    fireEvent.press(getByTestId('banner-actualizacion-descartar'));
    expect(onDescartar).toHaveBeenCalledTimes(1);
  });

  it('nunca reinicia solo', () => {
    renderBanner();
    expect(mockReloadAsync).not.toHaveBeenCalled();
  });

  // `fireEvent.press` no dispara el handler cuando RNTL ve accessibilityState.disabled,
  // así que no sirve para probar las guardas del handler: se invoca `onClick` del host,
  // que es lo que realmente llega a `onPress` en la app.
  const dispararOnPress = (boton: { props: Record<string, unknown> }) =>
    (boton.props.onClick as () => void)();

  it('dos toques en el mismo tick aplican el update una sola vez', async () => {
    const { getByTestId } = renderBanner();
    const boton = getByTestId('banner-actualizacion-reiniciar');

    dispararOnPress(boton);
    dispararOnPress(boton);

    await waitFor(() => expect(mockReloadAsync).toHaveBeenCalledTimes(1));
  });

  it('si el reinicio falla se puede volver a intentar', async () => {
    mockReloadAsync.mockRejectedValueOnce(new Error('no se pudo aplicar'));
    const { getByTestId } = renderBanner();
    const boton = getByTestId('banner-actualizacion-reiniciar');

    fireEvent.press(boton);
    await waitFor(() => expect(mockReloadAsync).toHaveBeenCalledTimes(1));

    fireEvent.press(boton);
    await waitFor(() => expect(mockReloadAsync).toHaveBeenCalledTimes(2));
  });

  it('con una sync en curso el botón queda bloqueado y no reinicia', async () => {
    let terminarSync!: () => void;
    const sync = marcandoActividadDeSync(() => new Promise<void>((r) => { terminarSync = r; }));
    const corriendo = sync();

    const { getByTestId, getByText } = renderBanner();

    await waitFor(() =>
      expect(getByText('Actualización lista · esperando que termine la sincronización')).toBeTruthy(),
    );
    const boton = getByTestId('banner-actualizacion-reiniciar');
    expect(boton.props.accessibilityState.disabled).toBe(true);
    // El handler tiene que negarse aunque el toque llegue igual: `disabled` es
    // presentación, y acá se puede perder trabajo del técnico.
    dispararOnPress(boton);
    expect(mockReloadAsync).not.toHaveBeenCalled();

    await act(async () => {
      terminarSync();
      await corriendo;
    });

    await waitFor(() => expect(getByText(/Hay una actualización lista/)).toBeTruthy());
    fireEvent.press(getByTestId('banner-actualizacion-reiniciar'));
    await waitFor(() => expect(mockReloadAsync).toHaveBeenCalledTimes(1));
  });
});
