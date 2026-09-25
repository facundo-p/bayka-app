/**
 * useConfirm — un diálogo de un solo botón (informativo) cerrado por back/backdrop debe
 * disparar el mismo onPress que tocar ese botón, para no perder un paso encadenado a él
 * (#656). Con 2+ botones, cerrar por fuera es cancelar: no dispara ninguno.
 */
import { renderHook, act } from '@testing-library/react-native';
import { useConfirm } from '../../src/hooks/useConfirm';

describe('useConfirm', () => {
  it('diálogo de un solo botón: dismiss() (back/backdrop) dispara el mismo onPress', () => {
    const onPress = jest.fn();
    const { result } = renderHook(() => useConfirm());

    act(() => {
      result.current.show({
        title: 'Aviso',
        message: 'Mensaje',
        buttons: [{ label: 'Entendido', onPress, style: 'primary' }],
      });
    });
    expect(result.current.confirmProps.visible).toBe(true);

    act(() => {
      result.current.dismiss();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(result.current.confirmProps.visible).toBe(false);
  });

  it('diálogo de 2+ botones: dismiss() (back/backdrop) no dispara ningún onPress', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() => useConfirm());

    act(() => {
      result.current.show({
        title: 'Confirmar',
        message: 'Mensaje',
        buttons: [
          { label: 'Cancelar', onPress: onCancel, style: 'cancel' },
          { label: 'Confirmar', onPress: onConfirm, style: 'primary' },
        ],
      });
    });

    act(() => {
      result.current.dismiss();
    });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(result.current.confirmProps.visible).toBe(false);
  });

  it('tocar el único botón dispara su onPress una sola vez (no también por el dismiss interno)', () => {
    const onPress = jest.fn();
    const { result } = renderHook(() => useConfirm());

    act(() => {
      result.current.show({
        title: 'Aviso',
        message: 'Mensaje',
        buttons: [{ label: 'Entendido', onPress, style: 'primary' }],
      });
    });

    act(() => {
      result.current.confirmProps.buttons[0].onPress();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(result.current.confirmProps.visible).toBe(false);
  });

  it('un nuevo show() reemplaza la acción de cierre del diálogo anterior', () => {
    const primeraAccion = jest.fn();
    const segundaAccion = jest.fn();
    const { result } = renderHook(() => useConfirm());

    act(() => {
      result.current.show({
        title: 'Primero',
        message: 'Mensaje',
        buttons: [{ label: 'Entendido', onPress: primeraAccion, style: 'primary' }],
      });
    });
    act(() => {
      result.current.show({
        title: 'Segundo',
        message: 'Mensaje',
        buttons: [{ label: 'Entendido', onPress: segundaAccion, style: 'primary' }],
      });
    });

    act(() => {
      result.current.dismiss();
    });

    expect(primeraAccion).not.toHaveBeenCalled();
    expect(segundaAccion).toHaveBeenCalledTimes(1);
  });
});
