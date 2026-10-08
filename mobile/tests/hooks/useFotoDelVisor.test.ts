import { act, renderHook } from '@testing-library/react-native';

import { useFotoDelVisor } from '../../src/hooks/useFotoDelVisor';

const ARBOLES = [
  { id: 't1', subId: 'A-1', fotoSynced: true },
  { id: 't2', subId: 'A-2', fotoSynced: false },
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

    it('el aviso depende de si la foto se subió', () => {
      const subida = setup();
      act(() => subida.hook.result.current.handleRemovePhoto('t1'));
      expect(subida.show.mock.calls[0][0].message).toContain('Se va a quitar de Bayka');
      const local = setup();
      act(() => local.hook.result.current.handleRemovePhoto('t2'));
      expect(local.show.mock.calls[0][0].message).toContain('Se va a quitar de este celular.');
    });

    it('árbol que ya no está: asume foto subida', () => {
      const { hook, show } = setup();
      act(() => hook.result.current.handleRemovePhoto('borrado'));
      expect(show.mock.calls[0][0].message).toContain('Se va a quitar de Bayka');
    });
  });
});
