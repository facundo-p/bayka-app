import { renderHook } from '@testing-library/react-native';

import { useAccionesDeArbol } from '../../src/hooks/useAccionesDeArbol';

const T1 = { id: 't1', posicion: 1, latitude: null };
const T2 = { id: 't2', posicion: 2, latitude: -34.6 };

function setup(
  seleccionado: { id: string; posicion: number; latitude: number | null } | null,
  overrides: Record<string, unknown> = {},
) {
  const grupo = {
    isReadOnly: false,
    sortedTrees: [T1, T2],
    undoLast: jest.fn().mockResolvedValue(undefined),
    executeDeleteTree: jest.fn().mockResolvedValue(undefined),
    captureTreeGps: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
  const show = jest.fn();
  const { result } = renderHook(() => useAccionesDeArbol(grupo as any, show, seleccionado));
  const aviso = () => show.mock.calls[0][0];
  return { acciones: result.current, grupo, show, aviso };
}

describe('useAccionesDeArbol', () => {
  describe('handleCaptureGps', () => {
    it('sin árbol seleccionado: no captura', async () => {
      const { acciones, grupo } = setup(null);
      await acciones.handleCaptureGps();
      expect(grupo.captureTreeGps).not.toHaveBeenCalled();
    });

    it('con señal: captura en el seleccionado sin avisar', async () => {
      const { acciones, grupo, show } = setup(T1);
      await acciones.handleCaptureGps();
      expect(grupo.captureTreeGps).toHaveBeenCalledWith('t1');
      expect(show).not.toHaveBeenCalled();
    });

    it('sin señal y sin punto previo: avisa', async () => {
      const { acciones, aviso } = setup(T1, { captureTreeGps: jest.fn().mockResolvedValue(false) });
      await acciones.handleCaptureGps();
      expect(aviso().title).toBe('Sin señal GPS');
      expect(aviso().message).toBe('No se pudo obtener un punto. Probá de nuevo cuando mejore la señal.');
    });

    it('sin señal con punto previo: avisa que se conserva', async () => {
      const { acciones, aviso } = setup(T2, { captureTreeGps: jest.fn().mockResolvedValue(false) });
      await acciones.handleCaptureGps();
      expect(aviso().message).toBe(
        'No se pudo obtener un punto. El punto anterior se conserva; probá de nuevo cuando mejore la señal.',
      );
    });
  });

  describe('handleDeleteSelected', () => {
    it('el último se deshace al instante, sin confirmar', () => {
      const { acciones, grupo, show } = setup(T2);
      acciones.handleDeleteSelected(T2);
      expect(grupo.undoLast).toHaveBeenCalled();
      expect(show).not.toHaveBeenCalled();
    });

    it('uno del medio pasa por la confirmación', () => {
      const { acciones, grupo, aviso } = setup(T1);
      acciones.handleDeleteSelected(T1);
      expect(grupo.undoLast).not.toHaveBeenCalled();
      expect(aviso().title).toBe('Eliminar árbol');
    });
  });

  describe('handleDeleteTree', () => {
    it('confirma con la posición y Eliminar ejecuta', () => {
      const { acciones, grupo, aviso } = setup(null);
      acciones.handleDeleteTree('t1', 1);
      expect(aviso().message).toBe(
        'Eliminar el árbol en posición 1? Las posiciones se recalcularán automáticamente.',
      );
      aviso().buttons.find((b: any) => b.label === 'Eliminar').onPress();
      expect(grupo.executeDeleteTree).toHaveBeenCalledWith('t1');
    });

    it('solo lectura: no hace nada', () => {
      const { acciones, show } = setup(null, { isReadOnly: true });
      acciones.handleDeleteTree('t1', 1);
      expect(show).not.toHaveBeenCalled();
    });
  });
});
