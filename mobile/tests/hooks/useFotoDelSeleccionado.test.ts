// Botón de foto de la botonera (#751): fotografía el árbol seleccionado en la tira.

import { act, renderHook } from '@testing-library/react-native';

import { useFotoDelSeleccionado, type ArbolFotografiable } from '../../src/hooks/useFotoDelSeleccionado';

const SIN_FOTO: ArbolFotografiable = { id: 't14', subId: 'A-14', fotoUrl: null, fotoSynced: true };
const CON_FOTO: ArbolFotografiable = { id: 't14', subId: 'A-14', fotoUrl: 'file:///a14.jpg', fotoSynced: true };

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

function setup(arbol: ArbolFotografiable | null, capturar = jest.fn().mockResolvedValue(undefined)) {
  const show = jest.fn();
  const onVerActual = jest.fn();
  const hook = renderHook(
    ({ a }) => useFotoDelSeleccionado({ arbol: a, capturar, show, onVerActual }),
    { initialProps: { a: arbol } },
  );
  const aviso = () => show.mock.calls[0][0];
  const boton = (label: string) => aviso().buttons.find((b: any) => b.label === label);
  return { hook, capturar, show, onVerActual, aviso, boton };
}

describe('useFotoDelSeleccionado', () => {
  it('grupo vacío: deshabilitado y tocar no hace nada', () => {
    const { hook, capturar, show } = setup(null);
    expect(hook.result.current.deshabilitado).toBe(true);
    act(() => hook.result.current.fotografiar());
    expect(capturar).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
  });

  it('árbol sin foto: abre la cámara directo, sin aviso', async () => {
    const { hook, capturar, show } = setup(SIN_FOTO);
    expect(hook.result.current.deshabilitado).toBe(false);
    await act(async () => hook.result.current.fotografiar());
    expect(show).not.toHaveBeenCalled();
    expect(capturar).toHaveBeenCalledWith('t14');
  });

  it('árbol con foto: avisa antes, con Cancelar / Ver actual / Reemplazar', () => {
    const { hook, capturar, aviso } = setup(CON_FOTO);
    act(() => hook.result.current.fotografiar());
    expect(aviso().message).toContain('A-14 ya tiene foto.');
    expect(aviso().buttons.map((b: any) => b.label)).toEqual(['Cancelar', 'Ver actual', 'Reemplazar']);
    expect(capturar).not.toHaveBeenCalled();
  });

  it('Cancelar no abre la cámara', () => {
    const { hook, capturar, boton, onVerActual } = setup(CON_FOTO);
    act(() => hook.result.current.fotografiar());
    act(() => boton('Cancelar').onPress());
    expect(capturar).not.toHaveBeenCalled();
    expect(onVerActual).not.toHaveBeenCalled();
  });

  it('Ver actual abre el visor con la foto del árbol y el reemplazo ya confirmado, sin capturar', () => {
    const { hook, capturar, boton, onVerActual } = setup(CON_FOTO);
    act(() => hook.result.current.fotografiar());
    act(() => boton('Ver actual').onPress());
    expect(onVerActual).toHaveBeenCalledWith({ uri: 'file:///a14.jpg', treeId: 't14', reemplazoConfirmado: true });
    expect(capturar).not.toHaveBeenCalled();
  });

  it('Reemplazar abre la cámara para ese árbol', async () => {
    const { hook, capturar, boton } = setup(CON_FOTO);
    act(() => hook.result.current.fotografiar());
    await act(async () => boton('Reemplazar').onPress());
    expect(capturar).toHaveBeenCalledWith('t14');
  });

  it('foto sin subir: el aviso dice que no está sincronizada', () => {
    const { hook, aviso } = setup({ ...CON_FOTO, fotoSynced: false });
    act(() => hook.result.current.fotografiar());
    expect(aviso().message).toContain('tiene una foto sin sincronizar');
  });

  it('mientras guarda: spinner, deshabilitado y un segundo toque no abre otra cámara', async () => {
    const pendiente = deferred();
    const { hook, capturar } = setup(SIN_FOTO, jest.fn(() => pendiente.promise));
    act(() => hook.result.current.fotografiar());
    expect(hook.result.current.capturando).toBe(true);
    expect(hook.result.current.deshabilitado).toBe(true);
    act(() => hook.result.current.fotografiar());
    expect(capturar).toHaveBeenCalledTimes(1);
    await act(async () => pendiente.resolve());
    expect(hook.result.current.capturando).toBe(false);
  });

  it('la foto va al árbol elegido al tocar aunque cambie la selección con el aviso abierto', async () => {
    const { hook, capturar, boton } = setup(CON_FOTO);
    act(() => hook.result.current.fotografiar());
    hook.rerender({ a: { id: 't15', subId: 'A-15', fotoUrl: null, fotoSynced: true } });
    await act(async () => boton('Reemplazar').onPress());
    expect(capturar).toHaveBeenCalledWith('t14');
  });

  it('foto quitada (fotoUrl vacía): abre la cámara directo', async () => {
    const { hook, capturar, show } = setup({ ...SIN_FOTO, fotoUrl: '' });
    await act(async () => hook.result.current.fotografiar());
    expect(show).not.toHaveBeenCalled();
    expect(capturar).toHaveBeenCalledWith('t14');
  });

  it('sin dato de sync: se avisa como foto subida', () => {
    const { hook, aviso } = setup({ ...CON_FOTO, fotoSynced: null });
    act(() => hook.result.current.fotografiar());
    expect(aviso().message).toContain('A-14 ya tiene foto.');
  });
});
