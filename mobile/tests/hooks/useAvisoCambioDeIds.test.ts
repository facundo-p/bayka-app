/** Cambiar el código de una parcela o grupo con árboles cambia sus IDs (#559): se pregunta antes. */
import { renderHook, act } from '@testing-library/react-native';
import { useAvisoCambioDeIds } from '../../src/hooks/useAvisoCambioDeIds';

function presionar(result: { current: ReturnType<typeof useAvisoCambioDeIds> }, label: string) {
  const boton = result.current.confirmProps.buttons.find((b) => b.label === label)!;
  act(() => boton.onPress());
}

describe('useAvisoCambioDeIds', () => {
  it('sin árboles no pregunta', async () => {
    const { result } = renderHook(() => useAvisoCambioDeIds());
    await expect(result.current.confirmarSiCambianIds(0, 'grupo')).resolves.toBe(true);
    expect(result.current.confirmProps.visible).toBe(false);
  });

  it('con árboles avisa cuántos IDs cambian y sigue si confirma', async () => {
    const { result } = renderHook(() => useAvisoCambioDeIds());
    let respuesta!: Promise<boolean>;
    act(() => { respuesta = result.current.confirmarSiCambianIds(12, 'parcela'); });

    expect(result.current.confirmProps).toMatchObject({
      visible: true,
      title: 'Cambian los IDs de los árboles',
      message: 'Los IDs de los 12 árboles de esta parcela se arman con su código: cambian todos. Si ya los anotaste o exportaste, esos IDs dejan de coincidir.',
    });
    presionar(result, 'Cambiar código');
    await expect(respuesta).resolves.toBe(true);
  });

  it('un solo árbol, en singular; cancelar no sigue', async () => {
    const { result } = renderHook(() => useAvisoCambioDeIds());
    let respuesta!: Promise<boolean>;
    act(() => { respuesta = result.current.confirmarSiCambianIds(1, 'grupo'); });

    expect(result.current.confirmProps.message).toBe(
      'El ID del árbol de este grupo se arma con su código: cambia. Si ya lo anotaste o exportaste, ese ID deja de coincidir.',
    );
    presionar(result, 'Cancelar');
    await expect(respuesta).resolves.toBe(false);
  });

  it('cerrar por fuera es cancelar', async () => {
    const { result } = renderHook(() => useAvisoCambioDeIds());
    let respuesta!: Promise<boolean>;
    act(() => { respuesta = result.current.confirmarSiCambianIds(3, 'grupo'); });
    act(() => result.current.confirmProps.onDismiss());
    await expect(respuesta).resolves.toBe(false);
  });
});
