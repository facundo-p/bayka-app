/**
 * Lógica de admin-users con dependencias inyectadas: el entry de Deno
 * (index.ts) le pasa los clientes reales de Supabase; los tests, mocks.
 * Este archivo no importa nada para poder testearse fuera de Deno (vitest).
 */

export const ROL = {
  ADMIN: 'admin',
  TECNICO: 'tecnico',
  SUPERADMIN: 'superadmin',
} as const;

export type Rol = (typeof ROL)[keyof typeof ROL];

const ROLES_VALIDOS: readonly string[] = [ROL.ADMIN, ROL.TECNICO, ROL.SUPERADMIN];

export const LONGITUD_MINIMA_PASSWORD = 8;

/** Mensajes de la API (contrato con la web: se muestran tal cual). */
export const MENSAJES = {
  sinPermisos: 'Necesitás permisos de superadmin para gestionar usuarios',
  autoDesactivacion: 'Un superadmin no puede desactivarse a sí mismo',
  ultimoSuperadmin: 'No podés desactivar al último superadmin activo',
  passwordDeOtroSuperadmin: 'No podés cambiar la contraseña de otro superadmin',
  emailDeOtroSuperadmin: 'No podés cambiar el email de otro superadmin',
  emailDuplicado: 'Ya existe un usuario con ese email',
  usuarioInexistente: 'Usuario inexistente',
  solicitudInvalida: 'Solicitud inválida',
  emailInvalido: 'Email inválido',
  rolInvalido: 'Rol inválido',
  nombreRequerido: 'El nombre es obligatorio',
  passwordCorta: `La contraseña debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres`,
  errorGenerico: 'No se pudo completar la operación. Probá de nuevo.',
} as const;

/** Los errores de duplicado del Auth Admin API dicen "... already ... registered"
 *  (el texto exacto varía entre crear y actualizar email). Contrato de GoTrue. */
const PATRON_AUTH_YA_REGISTRADO = /already.*registered/i;

export type PerfilDb = { id: string; nombre: string; rol: string; activo: boolean };

export type Deps = {
  /** Perfil del dueño del JWT recibido, o null si el token es inválido. */
  perfilDelToken: (jwt: string) => Promise<PerfilDb | null>;
  buscarPerfil: (userId: string) => Promise<PerfilDb | null>;
  contarSuperadminsActivos: () => Promise<number>;
  /** Invita por email; devuelve el id del usuario creado (para setear su rol). */
  invitar: (
    email: string,
    meta: { nombre: string },
  ) => Promise<{ error: string | null; userId: string | null }>;
  /** Setea el rol en profiles con service_role (el trigger crea siempre tecnico). */
  asignarRol: (userId: string, rol: string) => Promise<{ error: string | null }>;
  enviarRecuperacion: (email: string) => Promise<{ error: string | null }>;
  banear: (userId: string, banear: boolean) => Promise<{ error: string | null }>;
  actualizarAuth: (
    userId: string,
    campos: { password?: string; email?: string },
  ) => Promise<{ error: string | null }>;
  marcarActivo: (userId: string, activo: boolean) => Promise<{ error: string | null }>;
};

export type CuerpoAdminUsers =
  | { accion: 'crear'; nombre: string; email: string; rol: string }
  | { accion: 'reenviarInvitacion'; email: string }
  | { accion: 'desactivar' | 'reactivar'; userId: string }
  | { accion: 'cambiarPassword'; userId: string; password: string }
  | { accion: 'cambiarEmail'; userId: string; email: string };

export type Respuesta = { status: number; body: { ok: boolean; error?: string } };

const ok = (): Respuesta => ({ status: 200, body: { ok: true } });
const fallo = (status: number, error: string): Respuesta => ({
  status,
  body: { ok: false, error },
});

/** Validación mínima de email; la web la reutiliza para validar antes de enviar. */
export function emailValido(email: unknown): email is string {
  return typeof email === 'string' && /^\S+@\S+\.\S+$/.test(email);
}

function userIdValido(userId: unknown): userId is string {
  return typeof userId === 'string' && userId !== '';
}

/** null si pasó la validación; una Respuesta de error si no. */
function validarCuerpo(cuerpo: CuerpoAdminUsers): Respuesta | null {
  switch (cuerpo.accion) {
    case 'crear':
      if (typeof cuerpo.nombre !== 'string' || cuerpo.nombre.trim() === '') {
        return fallo(400, MENSAJES.nombreRequerido);
      }
      if (!emailValido(cuerpo.email)) return fallo(400, MENSAJES.emailInvalido);
      if (!ROLES_VALIDOS.includes(cuerpo.rol)) return fallo(400, MENSAJES.rolInvalido);
      return null;
    case 'reenviarInvitacion':
      return emailValido(cuerpo.email) ? null : fallo(400, MENSAJES.emailInvalido);
    case 'cambiarPassword':
      if (!userIdValido(cuerpo.userId)) return fallo(400, MENSAJES.solicitudInvalida);
      if (typeof cuerpo.password !== 'string' || cuerpo.password.length < LONGITUD_MINIMA_PASSWORD) {
        return fallo(400, MENSAJES.passwordCorta);
      }
      return null;
    case 'cambiarEmail':
      if (!userIdValido(cuerpo.userId)) return fallo(400, MENSAJES.solicitudInvalida);
      return emailValido(cuerpo.email) ? null : fallo(400, MENSAJES.emailInvalido);
    case 'desactivar':
    case 'reactivar':
      return userIdValido(cuerpo.userId) ? null : fallo(400, MENSAJES.solicitudInvalida);
    default:
      return fallo(400, MENSAJES.solicitudInvalida);
  }
}

/** Traduce un error del Auth Admin API a la respuesta del contrato. */
function falloDeAuth(error: string): Respuesta {
  if (PATRON_AUTH_YA_REGISTRADO.test(error)) return fallo(409, MENSAJES.emailDuplicado);
  return fallo(500, MENSAJES.errorGenerico);
}

async function desactivar(caller: PerfilDb, userId: string, deps: Deps): Promise<Respuesta> {
  const objetivo = await deps.buscarPerfil(userId);
  if (!objetivo) return fallo(404, MENSAJES.usuarioInexistente);
  if (objetivo.id === caller.id) return fallo(409, MENSAJES.autoDesactivacion);
  if (
    objetivo.rol === ROL.SUPERADMIN &&
    objetivo.activo &&
    (await deps.contarSuperadminsActivos()) <= 1
  ) {
    return fallo(409, MENSAJES.ultimoSuperadmin);
  }
  const ban = await deps.banear(userId, true);
  if (ban.error) return fallo(500, MENSAJES.errorGenerico);
  const marca = await deps.marcarActivo(userId, false);
  return marca.error ? fallo(500, MENSAJES.errorGenerico) : ok();
}

async function reactivar(userId: string, deps: Deps): Promise<Respuesta> {
  const objetivo = await deps.buscarPerfil(userId);
  if (!objetivo) return fallo(404, MENSAJES.usuarioInexistente);
  const ban = await deps.banear(userId, false);
  if (ban.error) return fallo(500, MENSAJES.errorGenerico);
  const marca = await deps.marcarActivo(userId, true);
  return marca.error ? fallo(500, MENSAJES.errorGenerico) : ok();
}

async function cambiarPassword(
  caller: PerfilDb,
  userId: string,
  password: string,
  deps: Deps,
): Promise<Respuesta> {
  const objetivo = await deps.buscarPerfil(userId);
  if (!objetivo) return fallo(404, MENSAJES.usuarioInexistente);
  if (objetivo.rol === ROL.SUPERADMIN && objetivo.id !== caller.id) {
    return fallo(403, MENSAJES.passwordDeOtroSuperadmin);
  }
  const cambio = await deps.actualizarAuth(userId, { password });
  return cambio.error ? fallo(500, MENSAJES.errorGenerico) : ok();
}

async function cambiarEmail(
  caller: PerfilDb,
  userId: string,
  email: string,
  deps: Deps,
): Promise<Respuesta> {
  const objetivo = await deps.buscarPerfil(userId);
  if (!objetivo) return fallo(404, MENSAJES.usuarioInexistente);
  // Mismo guard que cambiarPassword: sin él, cambiar el email de otro
  // superadmin a una casilla propia + reenviarInvitacion = toma de cuenta.
  if (objetivo.rol === ROL.SUPERADMIN && objetivo.id !== caller.id) {
    return fallo(403, MENSAJES.emailDeOtroSuperadmin);
  }
  const cambio = await deps.actualizarAuth(userId, { email });
  return cambio.error ? falloDeAuth(cambio.error) : ok();
}

async function ejecutarAccion(
  caller: PerfilDb,
  cuerpo: CuerpoAdminUsers,
  deps: Deps,
): Promise<Respuesta> {
  switch (cuerpo.accion) {
    case 'crear': {
      const invitacion = await deps.invitar(cuerpo.email, { nombre: cuerpo.nombre.trim() });
      if (invitacion.error) return falloDeAuth(invitacion.error);
      // El trigger crea siempre 'tecnico'; el rol elevado se setea acá con
      // service_role (nunca desde la metadata, controlable por el cliente).
      if (cuerpo.rol !== ROL.TECNICO && invitacion.userId) {
        const asignacion = await deps.asignarRol(invitacion.userId, cuerpo.rol);
        if (asignacion.error) return fallo(500, MENSAJES.errorGenerico);
      }
      return ok();
    }
    case 'reenviarInvitacion': {
      const envio = await deps.enviarRecuperacion(cuerpo.email);
      return envio.error ? fallo(500, MENSAJES.errorGenerico) : ok();
    }
    case 'desactivar':
      return desactivar(caller, cuerpo.userId, deps);
    case 'reactivar':
      return reactivar(cuerpo.userId, deps);
    case 'cambiarPassword':
      return cambiarPassword(caller, cuerpo.userId, cuerpo.password, deps);
    case 'cambiarEmail':
      return cambiarEmail(caller, cuerpo.userId, cuerpo.email, deps);
  }
}

/** Punto de entrada de la lógica: autoriza al caller y despacha la acción. */
export async function manejarAdminUsers(
  jwt: string | null,
  cuerpo: unknown,
  deps: Deps,
): Promise<Respuesta> {
  if (!jwt) return fallo(403, MENSAJES.sinPermisos);
  const caller = await deps.perfilDelToken(jwt);
  if (!caller || caller.rol !== ROL.SUPERADMIN || !caller.activo) {
    return fallo(403, MENSAJES.sinPermisos);
  }
  if (typeof cuerpo !== 'object' || cuerpo === null || !('accion' in cuerpo)) {
    return fallo(400, MENSAJES.solicitudInvalida);
  }
  const cuerpoTipado = cuerpo as CuerpoAdminUsers;
  const invalido = validarCuerpo(cuerpoTipado);
  if (invalido) return invalido;
  return ejecutarAccion(caller, cuerpoTipado, deps);
}
