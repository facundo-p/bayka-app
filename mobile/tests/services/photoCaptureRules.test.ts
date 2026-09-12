// Tests de la política de foto en la botonera (#439): lógica pura, sin UI.

import { PHOTO_CAPTURE_REQUIRED_DEFAULT } from '../../src/constants/photoCapture';
import {
  NN_PHOTO_POLICY,
  resolvePhotoForRegistration,
  speciesPhotoPolicy,
  type PickPhoto,
} from '../../src/services/photo/photoCaptureRules';

const FOTO = 'file:///foto.jpg';

function pickerQueDevuelve(valor: string | null): jest.MockedFunction<PickPhoto> {
  return jest.fn().mockResolvedValue(valor);
}

describe('speciesPhotoPolicy', () => {
  it('con el flag apagado no pide foto', () => {
    expect(speciesPhotoPolicy(false)).toEqual({ capture: false, required: PHOTO_CAPTURE_REQUIRED_DEFAULT });
  });

  it('con el flag prendido pide foto y la obligatoriedad sale de la constante', () => {
    expect(speciesPhotoPolicy(true)).toEqual({ capture: true, required: PHOTO_CAPTURE_REQUIRED_DEFAULT });
  });

  it('N/N siempre pide foto obligatoria', () => {
    expect(NN_PHOTO_POLICY).toEqual({ capture: true, required: true });
  });
});

describe('resolvePhotoForRegistration', () => {
  it('sin captura sigue sin foto y no abre el selector', async () => {
    const pickPhoto = pickerQueDevuelve(FOTO);
    await expect(
      resolvePhotoForRegistration({ capture: false, required: true }, pickPhoto),
    ).resolves.toEqual({ proceed: true, fotoUrl: null });
    expect(pickPhoto).not.toHaveBeenCalled();
  });

  it('obligatoria con foto: sigue con la foto y el selector no ofrece "Sin foto"', async () => {
    const pickPhoto = pickerQueDevuelve(FOTO);
    await expect(
      resolvePhotoForRegistration({ capture: true, required: true }, pickPhoto),
    ).resolves.toEqual({ proceed: true, fotoUrl: FOTO });
    expect(pickPhoto).toHaveBeenCalledWith({ optional: false });
  });

  it('obligatoria sin foto: no registra', async () => {
    await expect(
      resolvePhotoForRegistration({ capture: true, required: true }, pickerQueDevuelve(null)),
    ).resolves.toEqual({ proceed: false });
  });

  it('opcional sin foto: registra sin foto y el selector ofrece "Sin foto"', async () => {
    const pickPhoto = pickerQueDevuelve(null);
    await expect(
      resolvePhotoForRegistration({ capture: true, required: false }, pickPhoto),
    ).resolves.toEqual({ proceed: true, fotoUrl: null });
    expect(pickPhoto).toHaveBeenCalledWith({ optional: true });
  });

  it('opcional con foto: registra con la foto', async () => {
    await expect(
      resolvePhotoForRegistration({ capture: true, required: false }, pickerQueDevuelve(FOTO)),
    ).resolves.toEqual({ proceed: true, fotoUrl: FOTO });
  });
});
