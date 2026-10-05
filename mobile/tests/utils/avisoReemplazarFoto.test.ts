import {
  confirmarReemplazarFoto,
  confirmarReemplazoEnVisor,
  textoReemplazarFoto,
} from '../../src/utils/avisoReemplazarFoto';

const FOTO = { subId: 'A-14', fotoSynced: true };

describe('textoReemplazarFoto', () => {
  it('foto subida: avisa que se reemplaza en Bayka y en los demás celulares', () => {
    expect(textoReemplazarFoto('A-14', true)).toBe(
      'A-14 ya tiene foto. La nueva la reemplaza en Bayka y en los demás celulares en la próxima sincronización. No se puede deshacer.');
  });

  it('foto sin confirmar en Bayka: no afirma que sea solo local', () => {
    expect(textoReemplazarFoto('A-14', false)).toBe(
      'A-14 ya tiene una foto que puede no haberse subido a Bayka. La nueva la reemplaza. No se puede deshacer.');
  });
});

describe('confirmarReemplazarFoto', () => {
  function abrir(conVerActual: boolean) {
    const show = jest.fn();
    const onConfirm = jest.fn();
    const onVerActual = jest.fn();
    confirmarReemplazarFoto(show, FOTO, { onConfirm, onVerActual: conVerActual ? onVerActual : undefined });
    const config = show.mock.calls[0][0];
    const boton = (label: string) => config.buttons.find((b: any) => b.label === label);
    return { config, boton, onConfirm, onVerActual };
  }

  it('con Ver actual: Cancelar, Ver actual y Reemplazar, sin reemplazar todavía', () => {
    const { config, onConfirm } = abrir(true);
    expect(config.title).toBe('Reemplazar la foto');
    expect(config.icon).toBe('camera-outline');
    expect(config.message).toBe(textoReemplazarFoto('A-14', true));
    expect(config.buttons.map((b: any) => [b.label, b.style])).toEqual(
      [['Cancelar', 'cancel'], ['Ver actual', 'primary'], ['Reemplazar', 'primary']]);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('sin Ver actual (la foto ya está a la vista): solo Cancelar y Reemplazar', () => {
    const { config } = abrir(false);
    expect(config.buttons.map((b: any) => [b.label, b.style])).toEqual([['Cancelar', 'cancel'], ['Reemplazar', 'primary']]);
  });

  it('cancelar no reemplaza ni abre la foto actual', () => {
    const { boton, onConfirm, onVerActual } = abrir(true);
    boton('Cancelar').onPress();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onVerActual).not.toHaveBeenCalled();
  });

  it('Ver actual muestra la foto sin reemplazar', () => {
    const { boton, onConfirm, onVerActual } = abrir(true);
    boton('Ver actual').onPress();
    expect(onVerActual).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Reemplazar confirma', () => {
    const { boton, onConfirm } = abrir(false);
    boton('Reemplazar').onPress();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('confirmarReemplazoEnVisor', () => {
  it('sin confirmación previa pregunta con Cancelar y Reemplazar, sin reemplazar todavía', () => {
    const show = jest.fn();
    const onConfirm = jest.fn();
    confirmarReemplazoEnVisor(show, FOTO, undefined, onConfirm);
    expect(show.mock.calls[0][0].buttons.map((b: any) => b.label)).toEqual(['Cancelar', 'Reemplazar']);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('abierto desde Ver actual de un aviso: reemplaza sin volver a preguntar', () => {
    const show = jest.fn();
    const onConfirm = jest.fn();
    confirmarReemplazoEnVisor(show, FOTO, true, onConfirm);
    expect(show).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
