import { describe, expect, test, vi } from 'vitest';
import { MENSAJES, ROL, manejarAdminUsers, type Deps, type PerfilDb } from './nucleo';

function perfil(id: string, nombre: string, rol: string): PerfilDb {
  return { id, nombre, rol, activo: true, email: `${id}@bayka.org`, eliminado_en: null };
}

const SUPERADMIN = perfil('super-1', 'Sofía', ROL.SUPERADMIN);
const OTRO_SUPERADMIN = perfil('super-2', 'Selva', ROL.SUPERADMIN);
const ADMIN = perfil('admin-1', 'Ana', ROL.ADMIN);
const TECNICO = perfil('tec-1', 'Teo', ROL.TECNICO);
const ELIMINADO: PerfilDb = {
  ...TECNICO,
  activo: false,
  email: 'eliminado+tec-1@bayka.invalid',
  eliminado_en: '2026-09-01T00:00:00Z',
};

const SIN_REGISTROS = { arboles: 0, grupos: 0, plantaciones: 0 };
const CON_REGISTROS = { arboles: 12, grupos: 2, plantaciones: 0 };

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
    banearParaSiempre: vi.fn(async () => ({ error: null })),
    actualizarAuth: vi.fn(async () => ({ error: null })),
    marcarActivo: vi.fn(async () => ({ error: null })),
    marcarEliminado: vi.fn(async () => ({ error: null })),
    contarRegistros: vi.fn(async () => SIN_REGISTROS),
    borrarMembresias: vi.fn(async () => ({ error: null })),
    borrarUsuario: vi.fn(async () => ({ error: null })),
  };
}

/** Orden de llamada de los mocks dados, por nombre. */
function ordenDeLlamadas(deps: Deps, nombres: Array<keyof Deps>): Array<keyof Deps> {
  const orden = nombres.flatMap((nombre) =>
    (deps[nombre] as ReturnType<typeof vi.fn>).mock.invocationCallOrder.map((n) => ({ nombre, n })),
  );
  return orden.sort((a, b) => a.n - b.n).map(({ nombre }) => nombre);
}

const CREAR = {
  accion: 'crear',
  nombre: 'Nueva',
  email: 'nueva@bayka.org',
  rol: 'tecnico',
} as const;

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

  test('rate limit de emails → 429 accionable, no 500', async () => {
    const deps = crearDeps();
    deps.enviarRecuperacion = vi.fn(async () => ({ error: 'email rate limit exceeded' }));
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'reenviarInvitacion', email: 'teo@bayka.org' },
      deps,
    );
    expect(respuesta.status).toBe(429);
    expect(respuesta.body.error).toBe(MENSAJES.limiteEmails);
  });

  test('smtp_max_frequency ("only request this after") entra en el mismo 429', async () => {
    const deps = crearDeps();
    deps.enviarRecuperacion = vi.fn(async () => ({
      error: 'For security purposes, you can only request this after 42 seconds',
    }));
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'reenviarInvitacion', email: 'teo@bayka.org' },
      deps,
    );
    expect(respuesta.status).toBe(429);
    expect(respuesta.body.error).toBe(MENSAJES.limiteEmails);
  });
});

describe('mapeo de errores de Auth', () => {
  const casos = [
    { error: 'email rate limit exceeded', status: 429, mensaje: () => MENSAJES.limiteEmails },
    { error: 'over_email_send_rate_limit', status: 429, mensaje: () => MENSAJES.limiteEmails },
    { error: 'User already registered', status: 409, mensaje: () => MENSAJES.emailDuplicado },
    { error: 'algo raro del server', status: 500, mensaje: () => MENSAJES.errorGenerico },
  ];

  for (const caso of casos) {
    test(`crear con "${caso.error}" → ${caso.status}`, async () => {
      const deps = crearDeps();
      deps.invitar = vi.fn(async () => ({ error: caso.error, userId: null }));
      const respuesta = await manejarAdminUsers('jwt', CREAR, deps);
      expect(respuesta.status).toBe(caso.status);
      expect(respuesta.body.error).toBe(caso.mensaje());
    });
  }
});

describe('previsualizarEliminacion', () => {
  test.each([
    ['sin registros → real', SIN_REGISTROS, 'real'],
    ['con árboles o grupos → lógico', CON_REGISTROS, 'logico'],
    ['solo plantaciones creadas → lógico', { arboles: 0, grupos: 0, plantaciones: 1 }, 'logico'],
  ])('%s', async (_caso, registros, modo) => {
    const deps = crearDeps();
    deps.contarRegistros = vi.fn(async () => registros);
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'previsualizarEliminacion', userId: TECNICO.id },
      deps,
    );
    expect(respuesta).toEqual({ status: 200, body: { ok: true, preview: { ...registros, modo } } });
    expect(deps.contarRegistros).toHaveBeenCalledWith(TECNICO.id);
  });

  test('de un usuario ya eliminado → 409', async () => {
    const deps = crearDeps();
    deps.buscarPerfil = vi.fn(async () => ELIMINADO);
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'previsualizarEliminacion', userId: ELIMINADO.id },
      deps,
    );
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toBe(MENSAJES.usuarioEliminado);
  });
});

const PASOS_ELIMINACION: Array<keyof Deps> = [
  'banear',
  'banearParaSiempre',
  'marcarActivo',
  'borrarMembresias',
  'actualizarAuth',
  'marcarEliminado',
  'borrarUsuario',
];

describe('eliminar', () => {
  const ELIMINAR_TECNICO = { accion: 'eliminar', userId: TECNICO.id } as const;

  test('sin registros: borra membresías y después el usuario de Auth', async () => {
    const deps = crearDeps();
    const respuesta = await manejarAdminUsers('jwt', ELIMINAR_TECNICO, deps);
    expect(respuesta).toEqual({ status: 200, body: { ok: true } });
    expect(ordenDeLlamadas(deps, PASOS_ELIMINACION)).toEqual(['borrarMembresias', 'borrarUsuario']);
    expect(deps.borrarUsuario).toHaveBeenCalledWith(TECNICO.id);
  });

  test('con registros: ban, inactivo, membresías, email liberado y marca, en ese orden', async () => {
    const deps = crearDeps();
    deps.contarRegistros = vi.fn(async () => CON_REGISTROS);
    const respuesta = await manejarAdminUsers('jwt', ELIMINAR_TECNICO, deps);
    expect(respuesta.body.ok).toBe(true);
    expect(ordenDeLlamadas(deps, PASOS_ELIMINACION)).toEqual([
      'banearParaSiempre',
      'marcarActivo',
      'borrarMembresias',
      'actualizarAuth',
      'marcarEliminado',
    ]);
    expect(deps.marcarActivo).toHaveBeenCalledWith(TECNICO.id, false);
    expect(deps.actualizarAuth).toHaveBeenCalledWith(TECNICO.id, {
      email: 'eliminado+tec-1@bayka.invalid',
    });
  });

  test('con registros: si el ban falla no toca nada más', async () => {
    const deps = crearDeps();
    deps.contarRegistros = vi.fn(async () => CON_REGISTROS);
    deps.banearParaSiempre = vi.fn(async () => ({ error: 'auth down' }));
    const respuesta = await manejarAdminUsers('jwt', ELIMINAR_TECNICO, deps);
    expect(respuesta.status).toBe(500);
    expect(respuesta.body.error).toBe(MENSAJES.errorGenerico);
    expect(ordenDeLlamadas(deps, PASOS_ELIMINACION)).toEqual(['banearParaSiempre']);
  });

  test('con registros: si falla el cambio de email no marca eliminado (queda reintentable)', async () => {
    const deps = crearDeps();
    deps.contarRegistros = vi.fn(async () => CON_REGISTROS);
    deps.actualizarAuth = vi.fn(async () => ({ error: 'auth down' }));
    const respuesta = await manejarAdminUsers('jwt', ELIMINAR_TECNICO, deps);
    expect(respuesta.status).toBe(500);
    expect(deps.marcarEliminado).not.toHaveBeenCalled();
  });

  test('reintento con el email ya reemplazado: no lo vuelve a cambiar', async () => {
    const deps = crearDeps();
    deps.buscarPerfil = vi.fn(async () => ({
      ...TECNICO,
      activo: false,
      email: 'eliminado+tec-1@bayka.invalid',
    }));
    deps.contarRegistros = vi.fn(async () => CON_REGISTROS);
    const respuesta = await manejarAdminUsers('jwt', ELIMINAR_TECNICO, deps);
    expect(respuesta.body.ok).toBe(true);
    expect(deps.actualizarAuth).not.toHaveBeenCalled();
    expect(deps.marcarEliminado).toHaveBeenCalledWith(TECNICO.id);
  });

  test('sin registros: si falla borrar membresías no borra el usuario', async () => {
    const deps = crearDeps();
    deps.borrarMembresias = vi.fn(async () => ({ error: 'db down' }));
    const respuesta = await manejarAdminUsers('jwt', ELIMINAR_TECNICO, deps);
    expect(respuesta.status).toBe(500);
    expect(deps.borrarUsuario).not.toHaveBeenCalled();
  });

  test('a sí mismo → bloqueado', async () => {
    const deps = crearDeps();
    deps.buscarPerfil = vi.fn(async () => SUPERADMIN);
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'eliminar', userId: SUPERADMIN.id },
      deps,
    );
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toBe(MENSAJES.autoEliminacion);
    expect(deps.contarRegistros).not.toHaveBeenCalled();
  });

  test('último superadmin activo → bloqueado', async () => {
    const deps = crearDeps();
    deps.buscarPerfil = vi.fn(async () => OTRO_SUPERADMIN);
    deps.contarSuperadminsActivos = vi.fn(async () => 1);
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'eliminar', userId: OTRO_SUPERADMIN.id },
      deps,
    );
    expect(respuesta.body.error).toBe(MENSAJES.ultimoSuperadminEliminar);
    expect(ordenDeLlamadas(deps, PASOS_ELIMINACION)).toEqual([]);
  });

  test('ya eliminado → 409 sin tocar nada', async () => {
    const deps = crearDeps();
    deps.buscarPerfil = vi.fn(async () => ELIMINADO);
    const respuesta = await manejarAdminUsers('jwt', ELIMINAR_TECNICO, deps);
    expect(respuesta.body.error).toBe(MENSAJES.usuarioEliminado);
    expect(ordenDeLlamadas(deps, PASOS_ELIMINACION)).toEqual([]);
  });

  test('caller admin → 403', async () => {
    const deps = crearDeps(ADMIN);
    const respuesta = await manejarAdminUsers('jwt', ELIMINAR_TECNICO, deps);
    expect(respuesta.status).toBe(403);
    expect(deps.contarRegistros).not.toHaveBeenCalled();
  });

  test('sin userId → 400', async () => {
    const respuesta = await manejarAdminUsers('jwt', { accion: 'eliminar' }, crearDeps());
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toBe(MENSAJES.solicitudInvalida);
  });
});

describe('un usuario eliminado no admite cambios', () => {
  test.each([
    ['desactivar', { accion: 'desactivar', userId: ELIMINADO.id }],
    ['reactivar', { accion: 'reactivar', userId: ELIMINADO.id }],
    ['cambiarPassword', { accion: 'cambiarPassword', userId: ELIMINADO.id, password: 'segura123' }],
    ['cambiarEmail', { accion: 'cambiarEmail', userId: ELIMINADO.id, email: 'vuelve@bayka.org' }],
  ])('%s → 409', async (_accion, cuerpo) => {
    const deps = crearDeps();
    deps.buscarPerfil = vi.fn(async () => ELIMINADO);
    const respuesta = await manejarAdminUsers('jwt', cuerpo, deps);
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toBe(MENSAJES.usuarioEliminado);
    expect(ordenDeLlamadas(deps, PASOS_ELIMINACION)).toEqual([]);
  });

  test('reenviarInvitacion a su email reemplazado → 400 sin enviar nada', async () => {
    const deps = crearDeps();
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'reenviarInvitacion', email: 'eliminado+tec-1@bayka.invalid' },
      deps,
    );
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toBe(MENSAJES.emailInvalido);
    expect(deps.enviarRecuperacion).not.toHaveBeenCalled();
  });

  test('ningún usuario vivo puede tomar un email del dominio de eliminados', async () => {
    const deps = crearDeps();
    const respuesta = await manejarAdminUsers(
      'jwt',
      { accion: 'cambiarEmail', userId: TECNICO.id, email: 'x@BAYKA.invalid' },
      deps,
    );
    expect(respuesta.body.error).toBe(MENSAJES.emailInvalido);
    expect(deps.actualizarAuth).not.toHaveBeenCalled();
  });
});
