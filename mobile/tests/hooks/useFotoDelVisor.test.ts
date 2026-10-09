import { act, renderHook } from '@testing-library/react-native';

import { useFotoDelVisor } from '../../src/hooks/useFotoDelVisor';

const ARBOLES = [
  { id: 't1', subId: 'A-1', fotoUrl: 'file:///a1.jpg', fotoSynced: true },
  { id: 't2', subId: 'A-2', fotoUrl: 'file:///a2.jpg', fotoSynced: false },
];

function setup(pickResult: string | null = 'file:///nueva.jpg') {
  const show = jest.fn();
  const pickPhoto = jest.fn().mockResolvedValue(pickResult);
  const updatePhoto = jest.fn().mockResolvedValue(undefined);
  const removePhoto = jest.fn().mockResolvedValue(undefined);
  const hook = renderHook(() => useFotoDelVisor({ arboles: ARBOLES, show, pickPhoto, updatePhoto, removePhoto }));
  const boton = (label: string) => show.mock.calls[0][0].buttons.find((b: any) => b.label === label);
  return { hook, show, pickPhoto, updatePhoto, removePhoto, boton };
}

describe('useFotoDelVisor', () => {
  it('abrir y cerrar el visor', () => {
    const { hook } = setup();
    expect(hook.result.current.foto).toBeNull();
    act(() => hook.result.current.abrir({ uri: 'file:///a1.jpg', treeId: 't1' }));
    expect(hook.result.current.foto).toEqual({ uri: 'file:///a1.jpg', treeId: 't1' });
    act(() => hook.result.current.cerrar());
    expect(hook.result.current.foto).toBeNull();
  });

  describe('reemplazar', () => {
    it('pregunta sin «Ver actual» y no abre la cámara hasta confirmar', () => {
      const { hook, show, pickPhoto } = setup();
      act(() => hook.result.current.handleReplacePhoto({ uri: 'file:///a1.jpg', treeId: 't1' }));
      expect(show.mock.calls[0][0].message).toContain('A-1 ya tiene foto.');
      expect(show.mock.calls[0][0].buttons.map((b: any) => b.label)).toEqual(['Cancelar', 'Reemplazar']);
      expect(pickPhoto).not.toHaveBeenCalled();
    });

    it('Reemplazar guarda la foto nueva y la deja a la vista', async () => {
      const { hook, boton, updatePhoto } = setup();
      act(() => hook.result.current.handleReplacePhoto({ uri: 'file:///a1.jpg', treeId: 't1' }));
      await act(async () => boton('Reemplazar').onPress());
      expect(updatePhoto).toHaveBeenCalledWith('t1', 'file:///nueva.jpg');
      expect(hook.result.current.foto).toEqual({ uri: 'file:///nueva.jpg', treeId: 't1' });
    });

    it('con el reemplazo ya confirmado abre la cámara sin volver a preguntar', async () => {
      const { hook, show, pickPhoto, updatePhoto } = setup();
      await act(async () => hook.result.current.handleReplacePhoto(
        { uri: 'file:///a1.jpg', treeId: 't1', reemplazoConfirmado: true },
      ));
      expect(show).not.toHaveBeenCalled();
      expect(pickPhoto).toHaveBeenCalledTimes(1);
      expect(updatePhoto).toHaveBeenCalledWith('t1', 'file:///nueva.jpg');
    });

    it('cancelar la cámara no toca la foto ni el visor', async () => {
      const { hook, updatePhoto } = setup(null);
      act(() => hook.result.current.abrir({ uri: 'file:///a1.jpg', treeId: 't1', reemplazoConfirmado: true }));
      await act(async () => hook.result.current.handleReplacePhoto(hook.result.current.foto!));
      expect(updatePhoto).not.toHaveBeenCalled();
      expect(hook.result.current.foto?.uri).toBe('file:///a1.jpg');
    });

    it('árbol borrado con el visor abierto: no hace nada', () => {
      const { hook, show, pickPhoto } = setup();
      act(() => hook.result.current.handleReplacePhoto({ uri: 'file:///x.jpg', treeId: 'borrado', reemplazoConfirmado: true }));
      expect(show).not.toHaveBeenCalled();
      expect(pickPhoto).not.toHaveBeenCalled();
    });
  });

  describe('quitar', () => {
    it('confirma, quita la foto y cierra el visor', () => {
      const { hook, boton, removePhoto } = setup();
      act(() => hook.result.current.abrir({ uri: 'file:///a1.jpg', treeId: 't1' }));
      act(() => hook.result.current.handleRemovePhoto('t1'));
      expect(removePhoto).not.toHaveBeenCalled();
      act(() => boton('Quitar').onPress());
      expect(removePhoto).toHaveBeenCalledWith('t1');
      expect(hook.result.current.foto).toBeNull();
    });

    it('avisa que se quita para todos', () => {
      const { hook, show } = setup();
      act(() => hook.result.current.handleRemovePhoto('t1'));
      expect(show.mock.calls[0][0]).toMatchObject({
        title: 'Quitar la foto del árbol', message: 'Se quita para todos los que vean este árbol.',
      });
    });

    // #816: una foto sin subir se deshace sin preguntar.
    it('sin subir la quita sin confirmar y cierra el visor', () => {
      const { hook, show, removePhoto } = setup();
      act(() => hook.result.current.abrir({ uri: 'file:///a2.jpg', treeId: 't2' }));
      act(() => hook.result.current.handleRemovePhoto('t2'));
      expect(show).not.toHaveBeenCalled();
      expect(removePhoto).toHaveBeenCalledWith('t2');
      expect(hook.result.current.foto).toBeNull();
    });

    it('árbol que ya no está: pregunta igual', () => {
      const { hook, show } = setup();
      act(() => hook.result.current.handleRemovePhoto('borrado'));
      expect(show.mock.calls[0][0].title).toBe('Quitar la foto del árbol');
    });
  });
});
