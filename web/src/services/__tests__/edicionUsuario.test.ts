import { actualizarNombre, cambiarRol } from '../../repositories/profileRepository';
import { cambiarEmail } from '../adminUsersService';
import { guardarCambiosUsuario } from '../edicionUsuario';

vi.mock('../../repositories/profileRepository', () => ({
  actualizarNombre: vi.fn(),
  cambiarRol: vi.fn(),
}));

vi.mock('../adminUsersService', () => ({
  cambiarEmail: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(actualizarNombre).mockResolvedValue(undefined);
  vi.mocked(cambiarRol).mockResolvedValue(undefined);
  vi.mocked(cambiarEmail).mockResolvedValue(undefined);
});

test('sin cambios no llama a ningún backend', async () => {
  await guardarCambiosUsuario('user-1', {});
  expect(actualizarNombre).not.toHaveBeenCalled();
  expect(cambiarEmail).not.toHaveBeenCalled();
  expect(cambiarRol).not.toHaveBeenCalled();
});

test('solo llama al backend de cada campo presente', async () => {
  await guardarCambiosUsuario('user-1', { nombre: 'Ana' });
  expect(actualizarNombre).toHaveBeenCalledWith('user-1', 'Ana');
  expect(cambiarEmail).not.toHaveBeenCalled();
  expect(cambiarRol).not.toHaveBeenCalled();
});

test('los tres campos salen en paralelo: ninguno espera a otro', async () => {
  const pendientes: Array<() => void> = [];
  const colgada = () => new Promise<void>((resolver) => pendientes.push(resolver));
  vi.mocked(actualizarNombre).mockImplementation(colgada);
  vi.mocked(cambiarEmail).mockImplementation(colgada);
  vi.mocked(cambiarRol).mockImplementation(colgada);

  const guardado = guardarCambiosUsuario('user-1', {
    nombre: 'Ana',
    email: 'ana@bayka.org',
    rol: 'admin',
  });

  expect(pendientes).toHaveLength(3);
  pendientes.forEach((resolver) => resolver());
  await guardado;
  expect(cambiarEmail).toHaveBeenCalledWith('user-1', 'ana@bayka.org');
  expect(cambiarRol).toHaveBeenCalledWith('user-1', 'admin');
});

test('si un campo falla, el guardado falla con su mensaje', async () => {
  vi.mocked(cambiarEmail).mockRejectedValue(new Error('Ese email ya está registrado.'));
  await expect(
    guardarCambiosUsuario('user-1', { nombre: 'Ana', email: 'ana@bayka.org' }),
  ).rejects.toThrow('Ese email ya está registrado.');
  expect(actualizarNombre).toHaveBeenCalledWith('user-1', 'Ana');
});
