import { renderHook } from '@testing-library/react-native';

import { useAccionesDeGrupo } from '../../src/hooks/useAccionesDeGrupo';

function grupo(overrides: Record<string, unknown> = {}) {
  return {
    isReadOnly: false,
    canReactivate: true,
    totalCount: 3,
    unresolvedNN: 0,
    executeFinalize: jest.fn().mockResolvedValue(undefined),
    executeDeleteGroup: jest.fn().mockResolvedValue(undefined),
    executeReactivate: jest.fn().mockResolvedValue(true),
    executeReverseOrder: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function setup(overrides: Record<string, unknown> = {}, grupoId: string | undefined = 'g1') {
  const g = grupo(overrides);
  const show = jest.fn();
  const { result } = renderHook(() => useAccionesDeGrupo(g, show, grupoId));
  const aviso = (i = 0) => show.mock.calls[i][0];
  const boton = (label: string, i = 0) => aviso(i).buttons.find((b: any) => b.label === label);
  return { acciones: result.current, g, show, aviso, boton };
}

describe('useAccionesDeGrupo', () => {
  describe('handleFinalizar', () => {
    it('sin árboles: avisa que no se puede, sin confirmar', () => {
      const { acciones, g, aviso } = setup({ totalCount: 0 });
      acciones.handleFinalizar();
      expect(aviso().title).toBe('No se puede finalizar');
      expect(aviso().message).toBe('No hay árboles cargados.');
      expect(aviso().buttons.map((b: any) => b.label)).toEqual(['Entendido']);
      expect(g.executeFinalize).not.toHaveBeenCalled();
    });

    it('con árboles: confirma y Finalizar ejecuta', () => {
      const { acciones, g, aviso, boton } = setup();
      acciones.handleFinalizar();
      expect(aviso().title).toBe('Finalizar grupo');
      expect(aviso().message).toBe('Confirmar finalización? \n      ');
      boton('Finalizar').onPress();
      expect(g.executeFinalize).toHaveBeenCalled();
    });

    it('con N/N sin resolver: lo advierte, en singular y en plural', () => {
      const uno = setup({ unresolvedNN: 1 });
      uno.acciones.handleFinalizar();
      expect(uno.aviso().message).toBe(
        'Confirmar finalización? \n       Hay 1 árbol N/N sin resolver.\n      (deberan resolverse antes de sincronizar).',
      );
      const dos = setup({ unresolvedNN: 2 });
      dos.acciones.handleFinalizar();
      expect(dos.aviso().message).toContain('Hay 2 árboles N/N sin resolver.');
    });

    it('solo lectura: no hace nada', () => {
      const { acciones, show } = setup({ isReadOnly: true });
      acciones.handleFinalizar();
      expect(show).not.toHaveBeenCalled();
    });
  });

  describe('handleDeleteGroup', () => {
    it('doble confirmación con la cantidad de árboles antes de eliminar', () => {
      const { acciones, g, aviso, boton } = setup();
      acciones.handleDeleteGroup();
      expect(aviso().title).toBe('Eliminar grupo');
      expect(aviso().message).toBe('Este grupo tiene 3 árboles cargados. Esta acción no se puede deshacer.');
      boton('Confirmar eliminación').onPress();
      expect(g.executeDeleteGroup).not.toHaveBeenCalled();
      expect(aviso(1).message).toBe(
        'Esta es la confirmación final. El grupo y todos sus árboles serán eliminados permanentemente.',
      );
    });

    it('un árbol en singular; sin árboles, solo la advertencia', () => {
      const uno = setup({ totalCount: 1 });
      uno.acciones.handleDeleteGroup();
      expect(uno.aviso().message).toBe('Este grupo tiene 1 árbol cargado. Esta acción no se puede deshacer.');
      const vacio = setup({ totalCount: 0 });
      vacio.acciones.handleDeleteGroup();
      expect(vacio.aviso().message).toBe('Esta acción no se puede deshacer.');
    });

    it('solo lectura: no hace nada', () => {
      const { acciones, show } = setup({ isReadOnly: true });
      acciones.handleDeleteGroup();
      expect(show).not.toHaveBeenCalled();
    });
  });

  describe('handleReactivate', () => {
    it('confirma y Reactivar ejecuta', async () => {
      const { acciones, g, aviso, boton } = setup();
      acciones.handleReactivate();
      expect(aviso().title).toBe('Reactivar grupo');
      expect(aviso().message).toBe('Cambiar el estado del grupo a activa? Podrás registrar más árboles.');
      boton('Reactivar').onPress();
      expect(g.executeReactivate).toHaveBeenCalled();
    });

    it('sin permiso para reactivar o sin grupo: no hace nada', () => {
      const sinPermiso = setup({ canReactivate: false });
      sinPermiso.acciones.handleReactivate();
      expect(sinPermiso.show).not.toHaveBeenCalled();
      const sinGrupo = setup({}, '');
      sinGrupo.acciones.handleReactivate();
      expect(sinGrupo.show).not.toHaveBeenCalled();
    });
  });

  describe('handleReverseOrder', () => {
    it('confirma e Invertir ejecuta', () => {
      const { acciones, g, aviso, boton } = setup();
      acciones.handleReverseOrder();
      expect(aviso().title).toBe('Invertir Orden');
      expect(aviso().message).toBe('Invertir el orden de los árboles? Se recalcularán todas las posiciones y códigos.');
      boton('Invertir').onPress();
      expect(g.executeReverseOrder).toHaveBeenCalled();
    });

    it('solo lectura: no hace nada', () => {
      const { acciones, show } = setup({ isReadOnly: true });
      acciones.handleReverseOrder();
      expect(show).not.toHaveBeenCalled();
    });
  });
});
