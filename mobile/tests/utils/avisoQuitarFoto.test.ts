import { confirmarQuitarFoto } from '../../src/utils/avisoQuitarFoto';

const SUBIDA = { fotoUrl: 'file:///document/photos/photo_t1.jpg', fotoSynced: true };
const REMOTA = { fotoUrl: 'plantations/p/parcelas/x/trees/t1.jpg', fotoSynced: true };
const SIN_SUBIR = { fotoUrl: 'file:///document/photos/photo_t1.jpg', fotoSynced: false };

function quitar(foto: { fotoUrl: string | null; fotoSynced: boolean | null }) {
  const show = jest.fn();
  const onConfirm = jest.fn();
  confirmarQuitarFoto(show, foto, onConfirm);
  return { show, config: show.mock.calls[0]?.[0], onConfirm };
}

describe('confirmarQuitarFoto: foto ya subida (#816)', () => {
  it.each([['bajada', SUBIDA], ['sin bajar', REMOTA]])('%s: pide confirmar con el texto de quitar para todos', (_, foto) => {
    const { config, onConfirm } = quitar(foto);
    expect(config.title).toBe('Quitar la foto del árbol');
    expect(config.message).toBe('Se quita para todos los que vean este árbol.');
    expect(config.buttons.map((b: any) => [b.label, b.style])).toEqual([['Cancelar', 'cancel'], ['Quitar', 'danger']]);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('sin dato de sync pregunta igual', () => {
    expect(quitar({ fotoUrl: SIN_SUBIR.fotoUrl, fotoSynced: null }).show).toHaveBeenCalled();
  });

  it('cancelar no quita la foto', () => {
    const { config, onConfirm } = quitar(SUBIDA);
    config.buttons[0].onPress();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirmar quita la foto', () => {
    const { config, onConfirm } = quitar(SUBIDA);
    config.buttons[1].onPress();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('confirmarQuitarFoto: foto sin subir (#816)', () => {
  it('la deshace sin preguntar', () => {
    const { show, onConfirm } = quitar(SIN_SUBIR);
    expect(show).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
