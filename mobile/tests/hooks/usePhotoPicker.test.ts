// El tercer botón del selector cambia según la política (#439): "Cancelar" si la foto es obligatoria, "Sin foto" si es opcional.

jest.mock('../../src/components/PhotoCropProvider', () => ({
  usePhotoCaptureFlow: () => ({ requestPhoto: jest.fn().mockResolvedValue('file:///foto.jpg') }),
}));

import { renderHook } from '@testing-library/react-native';
import type { ConfirmModalButton } from '../../src/components/ConfirmModal';
import { usePhotoPicker } from '../../src/hooks/usePhotoPicker';

type ShowConfig = { buttons: ConfirmModalButton[] };

function renderPicker() {
  const show = jest.fn<void, [ShowConfig]>();
  const { result } = renderHook(() => usePhotoPicker(show as any));
  return { show, pickPhoto: result.current.pickPhoto };
}

function labels(show: jest.Mock<void, [ShowConfig]>): string[] {
  return show.mock.calls[0][0].buttons.map((boton) => boton.label);
}

describe('usePhotoPicker', () => {
  it('por default el tercer botón es "Cancelar"', () => {
    const { show, pickPhoto } = renderPicker();
    void pickPhoto();
    expect(labels(show)).toEqual(['Cámara', 'Galería', 'Cancelar']);
  });

  it('con optional el tercer botón es "Sin foto" y resuelve null', async () => {
    const { show, pickPhoto } = renderPicker();
    const promesa = pickPhoto({ optional: true });
    expect(labels(show)).toEqual(['Cámara', 'Galería', 'Sin foto']);
    show.mock.calls[0][0].buttons[2].onPress();
    await expect(promesa).resolves.toBeNull();
  });
});
