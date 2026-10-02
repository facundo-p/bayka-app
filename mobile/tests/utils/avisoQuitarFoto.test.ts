import { confirmarQuitarFoto, textoQuitarFoto } from '../../src/utils/avisoQuitarFoto';

describe('textoQuitarFoto', () => {
  it('foto subida: avisa que se quita de Bayka y de los demás celulares', () => {
    expect(textoQuitarFoto(true)).toBe(
      'Se va a quitar de Bayka y de los demás celulares en la próxima sincronización. No se puede deshacer.');
  });

  it('foto sin confirmar en Bayka: no afirma que sea solo local', () => {
    expect(textoQuitarFoto(false)).toBe(
      'Se va a quitar de este celular. Si la foto ya se había subido a Bayka, también se quita de Bayka y de los demás celulares en la próxima sincronización. No se puede deshacer.');
  });

  it('foto reemplazada y luego quitada (fotoSynced=false tras el reemplazo): avisa que puede quitarse de Bayka', () => {
    expect(textoQuitarFoto(false)).toContain('también se quita de Bayka');
  });
});

describe('confirmarQuitarFoto', () => {
  function abrir(fotoSynced: boolean) {
    const show = jest.fn();
    const onConfirm = jest.fn();
    confirmarQuitarFoto(show, fotoSynced, onConfirm);
    return { config: show.mock.calls[0][0], onConfirm };
  }

  it('abre un diálogo danger con Cancelar y Quitar, sin quitar nada todavía', () => {
    const { config, onConfirm } = abrir(true);
    expect(config.title).toBe('Quitar la foto');
    expect(config.buttons.map((b: any) => [b.label, b.style])).toEqual([['Cancelar', 'cancel'], ['Quitar', 'danger']]);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancelar no quita la foto', () => {
    const { config, onConfirm } = abrir(false);
    config.buttons[0].onPress();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirmar quita la foto', () => {
    const { config, onConfirm } = abrir(false);
    config.buttons[1].onPress();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
