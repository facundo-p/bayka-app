import { act, renderHook, waitFor } from '@testing-library/react';
import { useDescarga } from '../useDescarga';

const MENSAJE_ERROR = 'No se pudo descargar.';

test('éxito: descargando pasa a true y vuelve a false, mensaje queda null', async () => {
  const ejecutar = vi.fn().mockResolvedValue(null);
  const { result } = renderHook(() => useDescarga(ejecutar, MENSAJE_ERROR));

  expect(result.current.descargando).toBe(false);
  let promesa!: Promise<void>;
  act(() => {
    promesa = result.current.descargar();
  });
  expect(result.current.descargando).toBe(true);
  await act(() => promesa);

  expect(result.current.descargando).toBe(false);
  expect(result.current.mensaje).toBeNull();
  expect(ejecutar).toHaveBeenCalledTimes(1);
});

test('sin datos: `ejecutar` devuelve el mensaje informativo y no lo pisa un error', async () => {
  const ejecutar = vi.fn().mockResolvedValue('Sin datos para exportar.');
  const { result } = renderHook(() => useDescarga(ejecutar, MENSAJE_ERROR));

  await act(() => result.current.descargar());

  expect(result.current.mensaje).toBe('Sin datos para exportar.');
  expect(result.current.descargando).toBe(false);
});

test('error: `ejecutar` que lanza deja el mensaje de error genérico', async () => {
  const ejecutar = vi.fn().mockRejectedValue(new Error('boom'));
  const { result } = renderHook(() => useDescarga(ejecutar, MENSAJE_ERROR));

  await act(() => result.current.descargar());

  expect(result.current.mensaje).toBe(MENSAJE_ERROR);
  expect(result.current.descargando).toBe(false);
});

test('cada descarga limpia el mensaje previo antes de correr de nuevo', async () => {
  const ejecutar = vi.fn().mockResolvedValueOnce('primer mensaje').mockResolvedValueOnce(null);
  const { result } = renderHook(() => useDescarga(ejecutar, MENSAJE_ERROR));

  await act(() => result.current.descargar());
  expect(result.current.mensaje).toBe('primer mensaje');

  await act(() => result.current.descargar());
  await waitFor(() => expect(result.current.mensaje).toBeNull());
});
