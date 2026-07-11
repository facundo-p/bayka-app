import { describe, expect, test, vi } from 'vitest';
import {
  MENSAJES,
  ROL,
  manejarAdminUsers,
  type Deps,
  type PerfilDb,
} from './nucleo';

const SUPERADMIN: PerfilDb = { id: 'super-1', nombre: 'Sofía', rol: ROL.SUPERADMIN, activo: true };
const OTRO_SUPERADMIN: PerfilDb = { id: 'super-2', nombre: 'Selva', rol: ROL.SUPERADMIN, activo: true };
const ADMIN: PerfilDb = { id: 'admin-1', nombre: 'Ana', rol: ROL.ADMIN, activo: true };
const TECNICO: PerfilDb = { id: 'tec-1', nombre: 'Teo', rol: ROL.TECNICO, activo: true };

/** Deps felices por defecto; cada test pisa lo que necesita. */
function crearDeps(caller: PerfilDb | null = SUPERADMIN): Deps {
  return {
    perfilDelToken: vi.fn(async () => caller),
    buscarPerfil: vi.fn(async () => TECNICO),
    contarSuperadminsActivos: vi.fn(async () => 2),
    invitar: vi.fn(async () => ({ error: null, userId: 'nuevo-1' })),
    asignarRol: vi.fn(async () => ({ error: null })),
    enviarRecuperacion: vi.fn(async () => ({ error: null })),
    banear: vi.fn(async () => ({ error: null })),
    actualizarAuth: vi.fn(async () => ({ error: null })),
    marcarActivo: vi.fn(async () => ({ error: null })),
  };
}

const CREAR = { accion: 'crear', nombre: 'Nueva', email: 'nueva@bayka.org', rol: 'tecnico' } as const;

describe('autorización', () => {
  test.each([
    ['sin token', null, crearDeps()],
    ['token inválido', 'jwt', crearDeps(null)],
    ['caller técnico', 'jwt', crearDeps(TECNICO)],
    ['caller admin', 'jwt', crearDeps(ADMIN)],
    ['superadmin inactivo', 'jwt', crearDeps({ ...SUPERADMIN, activo: false })],
  ])('%s → 403 sin permisos', async (_caso, jwt, deps) => {
    const respuesta = await manejarAdminUsers(jwt, CREAR, deps);
    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error).toBe(MENSAJES.sinPermisos);
    expect(deps.invitar).not.toHaveBeenCalled();
  });

  test('cuerpo sin accion → 400', async () => {
    const respuesta = await manejarAdminUsers('jwt', { nombre: 'x' }, crearDeps());
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toBe(MENSAJES.solicitudInvalida);
  });
});

describe('crear', () => {
  test('feliz (técnico): invita solo con nombre y NO setea rol', async () => {
    const deps = crearDeps();
    const respuesta = await manejarAdminUsers('jwt', CREAR, deps);
    expect(respuesta).toEqual({ status: 200, body: { ok: true } });
    expect(deps.invitar).toHaveBeenCalledWith('nueva@bayka.org', { nombre: 'Nueva' });
    // El trigger ya crea 'tecnico': no hace falta asignarRol.
    expect(deps.asignarRol).not.toHaveBeenCalled();
  });

  test('rol elevado: tras invitar, setea el rol con service_role', async () => {
    const deps = crearDeps();
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'crear', nombre: 'Jefa', email: 'jefa@bayka.org', rol: 'admin' },
      deps,
    );
    expect(respuesta.body.ok).toBe(true);
    expect(deps.asignarRol).toHaveBeenCalledWith('nuevo-1', 'admin');
  });

  test('email ya registrado → 409 con mensaje claro', async () => {
    const deps = crearDeps();
    deps.invitar = vi.fn(async () => ({
      error: 'A user with this email address has already been registered',
    }));
    const respuesta = await manejarAdminUsers('jwt', CREAR, deps);
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toBe(MENSAJES.emailDuplicado);
  });

  test.each([
    ['nombre vacío', { ...CREAR, nombre: '  ' }, MENSAJES.nombreRequerido],
    ['email inválido', { ...CREAR, email: 'no-es-email' }, MENSAJES.emailInvalido],
    ['rol inválido', { ...CREAR, rol: 'dios' }, MENSAJES.rolInvalido],
  ])('%s → 400', async (_caso, cuerpo, mensaje) => {
    const respuesta = await manejarAdminUsers('jwt', cuerpo, crearDeps());
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toBe(mensaje);
  });
});

describe('desactivar', () => {
  test('feliz: banea y marca inactivo', async () => {
    const deps = crearDeps();
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'desactivar', userId: TECNICO.id },
      deps,
    );
    expect(respuesta.body.ok).toBe(true);
    expect(deps.banear).toHaveBeenCalledWith(TECNICO.id, true);
    expect(deps.marcarActivo).toHaveBeenCalledWith(TECNICO.id, false);
  });

  test('a sí mismo → bloqueado', async () => {
    const deps = crearDeps();
    deps.buscarPerfil = vi.fn(async () => SUPERADMIN);
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'desactivar', userId: SUPERADMIN.id },
      deps,
    );
    expect(respuesta.body.error).toBe(MENSAJES.autoDesactivacion);
    expect(deps.banear).not.toHaveBeenCalled();
  });

  test('último superadmin activo → bloqueado', async () => {
    const deps = crearDeps();
    deps.buscarPerfil = vi.fn(async () => OTRO_SUPERADMIN);
    deps.contarSuperadminsActivos = vi.fn(async () => 1);
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'desactivar', userId: OTRO_SUPERADMIN.id },
      deps,
    );
    expect(respuesta.body.error).toBe(MENSAJES.ultimoSuperadmin);
    expect(deps.banear).not.toHaveBeenCalled();
  });

  test('con dos superadmins activos, desactivar al otro está permitido', async () => {
    const deps = crearDeps();
    deps.buscarPerfil = vi.fn(async () => OTRO_SUPERADMIN);
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'desactivar', userId: OTRO_SUPERADMIN.id },
      deps,
    );
    expect(respuesta.body.ok).toBe(true);
  });

  test('usuario inexistente → 404', async () => {
    const deps = crearDeps();
    deps.buscarPerfil = vi.fn(async () => null);
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'desactivar', userId: 'nope' },
      deps,
    );
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error).toBe(MENSAJES.usuarioInexistente);
  });
});

describe('reactivar', () => {
  test('feliz: quita el ban y marca activo', async () => {
    const deps = crearDeps();
    deps.buscarPerfil = vi.fn(async () => ({ ...TECNICO, activo: false }));
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'reactivar', userId: TECNICO.id },
      deps,
    );
    expect(respuesta.body.ok).toBe(true);
    expect(deps.banear).toHaveBeenCalledWith(TECNICO.id, false);
    expect(deps.marcarActivo).toHaveBeenCalledWith(TECNICO.id, true);
  });
});

describe('cambiarPassword', () => {
  test('feliz para un técnico', async () => {
    const deps = crearDeps();
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'cambiarPassword', userId: TECNICO.id, password: 'segura123' },
      deps,
    );
    expect(respuesta.body.ok).toBe(true);
    expect(deps.actualizarAuth).toHaveBeenCalledWith(TECNICO.id, { password: 'segura123' });
  });

  test('a otro superadmin → 403', async () => {
    const deps = crearDeps();
    deps.buscarPerfil = vi.fn(async () => OTRO_SUPERADMIN);
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'cambiarPassword', userId: OTRO_SUPERADMIN.id, password: 'segura123' },
      deps,
    );
    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error).toBe(MENSAJES.passwordDeOtroSuperadmin);
    expect(deps.actualizarAuth).not.toHaveBeenCalled();
  });

  test('la propia sí está permitida', async () => {
    const deps = crearDeps();
    deps.buscarPerfil = vi.fn(async () => SUPERADMIN);
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'cambiarPassword', userId: SUPERADMIN.id, password: 'segura123' },
      deps,
    );
    expect(respuesta.body.ok).toBe(true);
  });

  test('password corta → 400', async () => {
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'cambiarPassword', userId: TECNICO.id, password: 'corta' },
      crearDeps(),
    );
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toBe(MENSAJES.passwordCorta);
  });
});

describe('cambiarEmail', () => {
  test('feliz: actualiza en Auth (el trigger sincroniza profiles)', async () => {
    const deps = crearDeps();
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'cambiarEmail', userId: TECNICO.id, email: 'nuevo@bayka.org' },
      deps,
    );
    expect(respuesta.body.ok).toBe(true);
    expect(deps.actualizarAuth).toHaveBeenCalledWith(TECNICO.id, { email: 'nuevo@bayka.org' });
  });

  test('email en uso por otro usuario → 409', async () => {
    const deps = crearDeps();
    deps.actualizarAuth = vi.fn(async () => ({
      error: 'Email address already registered by another user',
    }));
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'cambiarEmail', userId: TECNICO.id, email: 'usado@bayka.org' },
      deps,
    );
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toBe(MENSAJES.emailDuplicado);
  });

  test('a otro superadmin → 403 (evita toma de cuenta vía email+reset)', async () => {
    const deps = crearDeps();
    deps.buscarPerfil = vi.fn(async () => OTRO_SUPERADMIN);
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'cambiarEmail', userId: OTRO_SUPERADMIN.id, email: 'robo@bayka.org' },
      deps,
    );
    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error).toBe(MENSAJES.emailDeOtroSuperadmin);
    expect(deps.actualizarAuth).not.toHaveBeenCalled();
  });

  test('sin userId → 400 solicitud inválida (no 404)', async () => {
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'cambiarEmail', email: 'x@bayka.org' },
      crearDeps(),
    );
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toBe(MENSAJES.solicitudInvalida);
  });
});

describe('reenviarInvitacion', () => {
  test('feliz: manda el email de recuperación', async () => {
    const deps = crearDeps();
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'reenviarInvitacion', email: TECNICO.nombre + '@bayka.org' },
      deps,
    );
    expect(respuesta.body.ok).toBe(true);
    expect(deps.enviarRecuperacion).toHaveBeenCalledWith('Teo@bayka.org');
  });

  test('falla del envío → 500 genérico', async () => {
    const deps = crearDeps();
    deps.enviarRecuperacion = vi.fn(async () => ({ error: 'smtp down' }));
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'reenviarInvitacion', email: 'teo@bayka.org' },
      deps,
    );
    expect(respuesta.status).toBe(500);
    expect(respuesta.body.error).toBe(MENSAJES.errorGenerico);
  });
});
