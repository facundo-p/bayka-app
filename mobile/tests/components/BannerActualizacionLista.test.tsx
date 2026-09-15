/**
 * El botón de reinicio aplica un OTA descargado, y `reloadAsync` se lleva el
 * estado en memoria: no puede aparecer habilitado mientras hay una sync escribiendo
 * en la base (#446).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import BannerActualizacionLista from '../../src/components/BannerActualizacionLista';
import {
  marcandoActividadDeSync,
  __resetActividadDeSync,
} from '../../src/services/sync/syncActivityStore';

const MOCK_INSET_BOTTOM = 24;
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: MOCK_INSET_BOTTOM, left: 0, right: 0 }),
}));

const mockUseUpdates = jest.fn();
const mockReloadAsync = jest.fn();
jest.mock('expo-updates', () => ({
  useUpdates: () => mockUseUpdates(),
  reloadAsync: (...args: unknown[]) => mockReloadAsync(...args),
}));

describe('BannerActualizacionLista', () => {
  beforeEach(() => {
    mockUseUpdates.mockReturnValue({ isUpdatePending: true });
    mockReloadAsync.mockReset().mockResolvedValue(undefined);
    __resetActividadDeSync();
  });

  it('no renderiza nada sin un update pendiente', () => {
    mockUseUpdates.mockReturnValue({ isUpdatePending: false });
    const { queryByTestId } = render(<BannerActualizacionLista />);
    expect(queryByTestId('banner-actualizacion-lista')).toBeNull();
  });

  it('con un update pendiente ofrece reiniciar', () => {
    const { getByTestId, getByText } = render(<BannerActualizacionLista />);
    expect(getByTestId('banner-actualizacion-lista')).toBeTruthy();
    expect(getByText(/Hay una actualización lista/)).toBeTruthy();
  });

  it('ocupa el inset inferior: va al pie, no arriba de la status bar', () => {
    const { getByTestId } = render(<BannerActualizacionLista />);
    const estilo = StyleSheet.flatten(getByTestId('banner-actualizacion-lista').props.style);
    expect(estilo.paddingBottom).toBeGreaterThanOrEqual(MOCK_INSET_BOTTOM);
  });

  it('avisa que el reinicio cierra lo que el usuario esté haciendo', () => {
    const { getByText } = render(<BannerActualizacionLista />);
    expect(getByText(/se cierra lo que estés haciendo/)).toBeTruthy();
  });

  it('el botón aplica el update', async () => {
    const { getByTestId } = render(<BannerActualizacionLista />);
    fireEvent.press(getByTestId('banner-actualizacion-reiniciar'));
    await waitFor(() => expect(mockReloadAsync).toHaveBeenCalledTimes(1));
  });

  it('se puede descartar', () => {
    const { getByTestId, queryByTestId } = render(<BannerActualizacionLista />);
    fireEvent.press(getByTestId('banner-actualizacion-descartar'));
    expect(queryByTestId('banner-actualizacion-lista')).toBeNull();
  });

  it('nunca reinicia solo', () => {
    render(<BannerActualizacionLista />);
    expect(mockReloadAsync).not.toHaveBeenCalled();
  });

  // `fireEvent.press` no dispara el handler cuando RNTL ve accessibilityState.disabled,
  // así que no sirve para probar las guardas del handler: se invoca `onClick` del host,
  // que es lo que realmente llega a `onPress` en la app.
  const dispararOnPress = (boton: { props: Record<string, unknown> }) =>
    (boton.props.onClick as () => void)();

  it('dos toques en el mismo tick aplican el update una sola vez', async () => {
    const { getByTestId } = render(<BannerActualizacionLista />);
    const boton = getByTestId('banner-actualizacion-reiniciar');

    dispararOnPress(boton);
    dispararOnPress(boton);

    await waitFor(() => expect(mockReloadAsync).toHaveBeenCalledTimes(1));
  });

  it('si el reinicio falla se puede volver a intentar', async () => {
    mockReloadAsync.mockRejectedValueOnce(new Error('no se pudo aplicar'));
    const { getByTestId } = render(<BannerActualizacionLista />);
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

    const { getByTestId, getByText } = render(<BannerActualizacionLista />);

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
