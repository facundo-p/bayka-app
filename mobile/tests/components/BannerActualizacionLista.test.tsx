/**
 * El botón de reinicio aplica un OTA descargado, y `reloadAsync` se lleva el
 * estado en memoria: no puede aparecer habilitado mientras hay una sync escribiendo
 * en la base (#446).
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import BannerActualizacionLista from '../../src/components/BannerActualizacionLista';
import {
  marcandoActividadDeSync,
  __resetActividadDeSync,
} from '../../src/services/sync/syncActivityStore';

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
    expect(getByText('Hay una actualización lista')).toBeTruthy();
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
    fireEvent.press(boton);
    expect(mockReloadAsync).not.toHaveBeenCalled();

    await act(async () => {
      terminarSync();
      await corriendo;
    });

    await waitFor(() => expect(getByText('Hay una actualización lista')).toBeTruthy());
    fireEvent.press(getByTestId('banner-actualizacion-reiniciar'));
    await waitFor(() => expect(mockReloadAsync).toHaveBeenCalledTimes(1));
  });
});
