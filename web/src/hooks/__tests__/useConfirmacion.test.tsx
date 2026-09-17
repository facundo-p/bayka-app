import { act, waitFor } from '@testing-library/react';
import { renderHookConQuery } from '../../test/renderHookConQuery';
import { useConfirmacion, type OpcionesConfirmacion } from '../useConfirmacion';

function montar(opciones: Partial<OpcionesConfirmacion> = {}) {
  const onClose = vi.fn();
  const accion = vi.fn().mockResolvedValue(undefined);
  const hook = renderHookConQuery(() => useConfirmacion({ accion, onClose, ...opciones }));
  return { ...hook, onClose, accion };
}

test('sin texto de éxito: ejecuta, corre alCompletar y cierra', async () => {
  const alCompletar = vi.fn().mockResolvedValue(undefined);
  const { result, onClose, accion } = montar({ alCompletar });

  act(() => result.current.confirmar());

  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(accion).toHaveBeenCalledTimes(1);
  expect(alCompletar).toHaveBeenCalledTimes(1);
  expect(result.current.completada).toBe(false);
});

test('sin alCompletar también cierra', async () => {
  const { result, onClose } = montar();

  act(() => result.current.confirmar());

  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
});

test('con texto de éxito queda completada en vez de cerrar', async () => {
  const { result, onClose } = montar({ textoExito: 'Invitación enviada.' });

  act(() => result.current.confirmar());

  await waitFor(() => expect(result.current.completada).toBe(true));
  expect(onClose).not.toHaveBeenCalled();
});

test('si la acción falla expone el error, no cierra ni queda completada', async () => {
  const { result, onClose } = montar({
    accion: vi.fn().mockRejectedValue(new Error('No se pudo desactivar al usuario.')),
    textoExito: 'Listo.',
  });

  act(() => result.current.confirmar());

  await waitFor(() => expect(result.current.error).toBe('No se pudo desactivar al usuario.'));
  expect(result.current.completada).toBe(false);
  expect(onClose).not.toHaveBeenCalled();
});
