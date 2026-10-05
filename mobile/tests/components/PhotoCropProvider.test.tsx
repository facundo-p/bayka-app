// Flujo de captura (#749): pickPhoto abre la cámara directo; la galería sale de la cámara y vuelve a ella si se cancela.

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { launchGalleryRaw } from '../../src/services/PhotoService';
import { PhotoCropProvider, usePhotoCaptureFlow } from '../../src/components/PhotoCropProvider';
import type { PickPhoto } from '../../src/services/photo/photoCaptureRules';

jest.mock('../../src/services/PhotoService', () => ({ launchGalleryRaw: jest.fn() }));

// Dobles mínimos: un botón por callback, visibles solo en su etapa.
jest.mock('../../src/components/CameraCaptureView', () => {
  const { createElement: h } = require('react');
  const { Pressable, Text, View } = require('react-native');
  const boton = (label: string, onPress: () => void) => h(Pressable, { onPress }, h(Text, null, label));
  return (props: any) => (props.visible
    ? h(View, { testID: 'camara' },
      h(Text, null, props.optional ? 'foto opcional' : 'foto obligatoria'),
      boton('capturar', () => props.onCapture({ uri: 'file:///camara.jpg', width: 1, height: 1 })),
      boton('galería', props.onGallery),
      boton('cancelar cámara', props.onCancel))
    : null);
});
jest.mock('../../src/components/PhotoCropModal', () => {
  const { createElement: h } = require('react');
  const { Pressable, Text, View } = require('react-native');
  const boton = (label: string, onPress: () => void) => h(Pressable, { onPress }, h(Text, null, label));
  return (props: any) => (props.raw
    ? h(View, { testID: 'recorte' },
      h(Text, null, props.raw.uri),
      boton('guardar', () => props.onSave(props.raw.uri)),
      boton('reintentar', props.onRetry),
      boton('cancelar recorte', props.onCancel))
    : null);
});

const mockedGallery = launchGalleryRaw as jest.Mock;
const FOTO_GALERIA = { uri: 'file:///galeria.jpg', width: 1, height: 1 };

function renderFlujo(): { pickPhoto: PickPhoto } {
  const ref: { pickPhoto?: PickPhoto } = {};
  function Consumidor() {
    ref.pickPhoto = usePhotoCaptureFlow().pickPhoto;
    return null;
  }
  render(<PhotoCropProvider><Consumidor /></PhotoCropProvider>);
  return { pickPhoto: (options) => ref.pickPhoto!(options) };
}

function abrir(options?: { optional?: boolean }): Promise<string | null> {
  const { pickPhoto } = renderFlujo();
  let promesa!: Promise<string | null>;
  act(() => { promesa = pickPhoto(options); });
  return promesa;
}

beforeEach(() => mockedGallery.mockReset());

describe('pickPhoto', () => {
  it('abre la cámara directo, sin pasar por un menú', () => {
    void abrir();
    expect(screen.getByTestId('camara')).toBeTruthy();
    expect(screen.getByText('foto obligatoria')).toBeTruthy();
    expect(mockedGallery).not.toHaveBeenCalled();
  });

  it('con optional la cámara lo recibe', () => {
    void abrir({ optional: true });
    expect(screen.getByText('foto opcional')).toBeTruthy();
  });

  it('cancelar la cámara resuelve null y la cierra', async () => {
    const promesa = abrir({ optional: true });
    fireEvent.press(screen.getByText('cancelar cámara'));
    await expect(promesa).resolves.toBeNull();
    expect(screen.queryByTestId('camara')).toBeNull();
  });
});

describe('galería desde la cámara', () => {
  it('cierra la cámara antes de abrir la galería y sigue al recorte', async () => {
    let camaraAbiertaAlLanzar: boolean | null = null;
    mockedGallery.mockImplementation(async () => {
      camaraAbiertaAlLanzar = screen.queryByTestId('camara') !== null;
      return FOTO_GALERIA;
    });
    const promesa = abrir();
    fireEvent.press(screen.getByText('galería'));
    await waitFor(() => expect(screen.getByTestId('recorte')).toBeTruthy());
    expect(camaraAbiertaAlLanzar).toBe(false);
    expect(screen.getByText(FOTO_GALERIA.uri)).toBeTruthy();
    fireEvent.press(screen.getByText('guardar'));
    await expect(promesa).resolves.toBe(FOTO_GALERIA.uri);
  });

  it('si se cancela la galería vuelve a la cámara con la misma Promise', async () => {
    mockedGallery.mockResolvedValue(null);
    const promesa = abrir();
    fireEvent.press(screen.getByText('galería'));
    await waitFor(() => expect(screen.getByTestId('camara')).toBeTruthy());
    expect(mockedGallery).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByText('capturar'));
    fireEvent.press(screen.getByText('guardar'));
    await expect(promesa).resolves.toBe('file:///camara.jpg');
  });

  it('un error de la galería también vuelve a la cámara', async () => {
    mockedGallery.mockRejectedValue(new Error('sin permiso'));
    void abrir();
    fireEvent.press(screen.getByText('galería'));
    await waitFor(() => expect(screen.getByTestId('camara')).toBeTruthy());
  });
});

describe('recorte', () => {
  it('Reintentar vuelve a la cámara aunque la foto haya venido de la galería', async () => {
    mockedGallery.mockResolvedValue(FOTO_GALERIA);
    void abrir();
    fireEvent.press(screen.getByText('galería'));
    await waitFor(() => expect(screen.getByTestId('recorte')).toBeTruthy());
    fireEvent.press(screen.getByText('reintentar'));
    expect(screen.getByTestId('camara')).toBeTruthy();
    expect(screen.queryByTestId('recorte')).toBeNull();
    expect(mockedGallery).toHaveBeenCalledTimes(1);
  });

  it('cancelar el recorte resuelve null', async () => {
    const promesa = abrir();
    fireEvent.press(screen.getByText('capturar'));
    fireEvent.press(screen.getByText('cancelar recorte'));
    await expect(promesa).resolves.toBeNull();
  });
});
