import { act, waitFor } from '@testing-library/react';
import type { UsuarioConAsignaciones } from '../../../queries/usuarioQueries';
import { guardarCambiosUsuario } from '../../../services/edicionUsuario';
import { espiarInvalidaciones } from '../../../test/espiarInvalidaciones';
import { eventoCambio, eventoEnvio, renderHookConQuery } from '../../../test/renderHookConQuery';
import { useEdicionUsuario } from '../useEdicionUsuario';

vi.mock('../../../services/edicionUsuario', () => ({
  guardarCambiosUsuario: vi.fn(),
}));

const PERSONA: UsuarioConAsignaciones = {
  id: 'user-x',
  nombre: 'Equis',
  rol: 'tecnico',
  email: 'x@bayka.org',
  activo: true,
  organizacionId: 'org-1',
  organizacionNombre: 'Bayka',
  plantacionesAsignadas: 0,
  createdAt: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(guardarCambiosUsuario).mockResolvedValue(undefined);
});

function montar(rolEditable = true) {
  const onCerrar = vi.fn();
  const hook = renderHookConQuery(() => useEdicionUsuario(PERSONA, rolEditable, onCerrar));
  return { ...hook, onCerrar };
}

test('arranca con los datos de la persona y sin poder guardar', () => {
  const { result } = montar();
  expect(result.current.valores).toEqual({ nombre: 'Equis', email: 'x@bayka.org', rol: 'tecnico' });
  expect(result.current.valido).toBe(false);
});

test('envía solo lo que cambió, recortado, y cierra', async () => {
  const { result, onCerrar } = montar();

  act(() => result.current.alEscribir('nombre')(eventoCambio('  Ana  ')));
  expect(result.current.valido).toBe(true);
  act(() => result.current.enviar(eventoEnvio()));

  await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  expect(guardarCambiosUsuario).toHaveBeenCalledWith('user-x', { nombre: 'Ana' });
});

test('con el rol bloqueado por su guard, cambiar el selector no habilita guardar', () => {
  const { result } = montar(false);
  act(() => result.current.cambiar('rol', 'admin'));
  expect(result.current.valido).toBe(false);
});

test('si el guardado falla muestra el error, no cierra e igual refresca el listado', async () => {
  vi.mocked(guardarCambiosUsuario).mockRejectedValue(new Error('Ese email ya está registrado.'));
  const invalidaciones = espiarInvalidaciones();
  const { result, onCerrar } = montar();

  act(() => result.current.cambiar('email', 'otro@bayka.org'));
  act(() => result.current.enviar(eventoEnvio()));

  await waitFor(() => expect(result.current.errorEnvio).toBe('Ese email ya está registrado.'));
  await waitFor(() => expect(invalidaciones).toHaveBeenCalledWith({ queryKey: ['usuarios'] }));
  expect(onCerrar).not.toHaveBeenCalled();
});
