/** Lógica de admin-users con deps inyectadas (index.ts pasa clientes reales, los tests mocks); sin imports, testeable fuera de Deno. */

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
  autoEliminacion: 'Un superadmin no puede eliminarse a sí mismo',
  ultimoSuperadminEliminar: 'No podés eliminar al último superadmin activo',
  usuarioEliminado: 'El usuario fue eliminado: ya no admite cambios',
  passwordDeOtroSuperadmin: 'No podés cambiar la contraseña de otro superadmin',
  emailDeOtroSuperadmin: 'No podés cambiar el email de otro superadmin',
  emailDuplicado: 'Ya existe un usuario con ese email',
  usuarioInexistente: 'Usuario inexistente',
  solicitudInvalida: 'Solicitud inválida',
  emailInvalido: 'Email inválido',
  rolInvalido: 'Rol inválido',
  nombreRequerido: 'El nombre es obligatorio',
  passwordCorta: `La contraseña debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres`,
  limiteEmails: 'Alcanzaste el límite de emails. Esperá unos minutos y probá de nuevo.',
  errorGenerico: 'No se pudo completar la operación. Probá de nuevo.',
} as const;

/** Errores de duplicado de GoTrue: "... already ... registered" (texto varía entre crear/actualizar). */
const PATRON_AUTH_YA_REGISTRADO = /already.*registered/i;

/** Cuota de emails de GoTrue: "email rate limit exceeded" y "over_email_send_rate_limit"
 *  (rate_limit_email_sent), más el "only request this after N seconds" de
 *  smtp_max_frequency. El texto cambia entre versiones: si no matchea, cae al 500. */
const PATRON_AUTH_RATE_LIMIT = /rate.?limit|only request this after/i;

export type PerfilDb = {
  id: string;
  nombre: string;
  rol: string;
  activo: boolean;
  email: string | null;
  eliminado_en: string | null;
};

/** Dominio reservado (RFC 2606): nunca recibe mails ni choca con un email real. */
export const DOMINIO_EMAIL_ELIMINADO = 'bayka.invalid';

/** Reemplazo del email de un eliminado con datos: libera el original para reinvitarlo. */
export function emailDeEliminado(userId: string): string {
  return `eliminado+${userId}@${DOMINIO_EMAIL_ELIMINADO}`;
}

function esEmailDeEliminado(email: string): boolean {
  return email.toLowerCase().endsWith(`@${DOMINIO_EMAIL_ELIMINADO}`);
}

function esEliminado(perfil: PerfilDb): boolean {
  return perfil.eliminado_en !== null;
}

/** Real: se borra de Auth. Lógico: tiene datos de campo a su nombre y se bloquea para siempre. */
export const MODO_ELIMINACION = {
  real: 'real',
  logico: 'logico',
} as const;

export type ModoEliminacion = (typeof MODO_ELIMINACION)[keyof typeof MODO_ELIMINACION];

/** Filas que referencian al usuario con FKs sin cascade: impiden borrarlo de Auth. */
export type RegistrosUsuario = { arboles: number; grupos: number; plantaciones: number };

export type PreviewEliminacion = RegistrosUsuario & { modo: ModoEliminacion };

export function modoEliminacion({
  arboles,
  grupos,
  plantaciones,
}: RegistrosUsuario): ModoEliminacion {
  return arboles + grupos + plantaciones > 0 ? MODO_ELIMINACION.logico : MODO_ELIMINACION.real;
}

type ResultadoOperacion = { error: string | null };

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
  asignarRol: (userId: string, rol: string) => Promise<ResultadoOperacion>;
  enviarRecuperacion: (email: string) => Promise<ResultadoOperacion>;
  banear: (userId: string, banear: boolean) => Promise<ResultadoOperacion>;
  /** Ban sin vuelta atrás práctica, a diferencia del reversible de desactivar. */
  banearParaSiempre: (userId: string) => Promise<ResultadoOperacion>;
  actualizarAuth: (
    userId: string,
    campos: { password?: string; email?: string },
  ) => Promise<ResultadoOperacion>;
  marcarActivo: (userId: string, activo: boolean) => Promise<ResultadoOperacion>;
  /** eliminado_en = now(); la DB exige activo = false antes. */
  marcarEliminado: (userId: string) => Promise<ResultadoOperacion>;
  /** Lanza ante error de DB. */
  contarRegistros: (userId: string) => Promise<RegistrosUsuario>;
  borrarMembresias: (userId: string) => Promise<ResultadoOperacion>;
  /** Borra de Auth; el profile cae por cascade. */
  borrarUsuario: (userId: string) => Promise<ResultadoOperacion>;
};

export type CuerpoAdminUsers =
  | { accion: 'crear'; nombre: string; email: string; rol: string }
  | { accion: 'reenviarInvitacion'; email: string }
  | { accion: 'desactivar' | 'reactivar' | 'previsualizarEliminacion' | 'eliminar'; userId: string }
  | { accion: 'cambiarPassword'; userId: string; password: string }
  | { accion: 'cambiarEmail'; userId: string; email: string };

export type Respuesta = {
  status: number;
  body: { ok: boolean; error?: string; preview?: PreviewEliminacion };
};

const ok = (): Respuesta => ({ status: 200, body: { ok: true } });
const fallo = (status: number, error: string): Respuesta => ({
  status,
  body: { ok: false, error },
});

/** Validación mínima de email; la web la reutiliza para validar antes de enviar. El dominio de
 *  eliminados no vale: un usuario vivo con ese email se confundiría con uno eliminado. */
export function emailValido(email: unknown): email is string {
  return typeof email === 'string' && /^\S+@\S+\.\S+$/.test(email) && !esEmailDeEliminado(email);
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
      if (
        typeof cuerpo.password !== 'string' ||
        cuerpo.password.length < LONGITUD_MINIMA_PASSWORD
      ) {
        return fallo(400, MENSAJES.passwordCorta);
      }
      return null;
    case 'cambiarEmail':
      if (!userIdValido(cuerpo.userId)) return fallo(400, MENSAJES.solicitudInvalida);
      return emailValido(cuerpo.email) ? null : fallo(400, MENSAJES.emailInvalido);
    case 'desactivar':
    case 'reactivar':
    case 'previsualizarEliminacion':
    case 'eliminar':
      return userIdValido(cuerpo.userId) ? null : fallo(400, MENSAJES.solicitudInvalida);
    default:
      return fallo(400, MENSAJES.solicitudInvalida);
  }
}

function falloDeAuth(error: string): Respuesta {
  if (PATRON_AUTH_YA_REGISTRADO.test(error)) return fallo(409, MENSAJES.emailDuplicado);
  // Un rate limit no es un fallo del sistema: reintentar consume más cuota.
  if (PATRON_AUTH_RATE_LIMIT.test(error)) return fallo(429, MENSAJES.limiteEmails);
  return fallo(500, MENSAJES.errorGenerico);
}

type Busqueda = { objetivo: PerfilDb; rechazo: null } | { objetivo: null; rechazo: Respuesta };

/** El usuario a modificar; un eliminado ya no admite cambios. */
async function buscarModificable(userId: string, deps: Deps): Promise<Busqueda> {
  const objetivo = await deps.buscarPerfil(userId);
  if (!objetivo) return { objetivo: null, rechazo: fallo(404, MENSAJES.usuarioInexistente) };
  if (esEliminado(objetivo)) {
    return { objetivo: null, rechazo: fallo(409, MENSAJES.usuarioEliminado) };
  }
  return { objetivo, rechazo: null };
}

type MensajesBaja = { aSiMismo: string; ultimoSuperadmin: string };

const MENSAJES_DESACTIVAR: MensajesBaja = {
  aSiMismo: MENSAJES.autoDesactivacion,
  ultimoSuperadmin: MENSAJES.ultimoSuperadmin,
};

const MENSAJES_ELIMINAR: MensajesBaja = {
  aSiMismo: MENSAJES.autoEliminacion,
  ultimoSuperadmin: MENSAJES.ultimoSuperadminEliminar,
};

/** Guards de desactivar y eliminar: nadie se da de baja a sí mismo ni deja sin superadmin activo. */
async function rechazoDeBaja(
  caller: PerfilDb,
  objetivo: PerfilDb,
  mensajes: MensajesBaja,
  deps: Deps,
): Promise<Respuesta | null> {
  if (objetivo.id === caller.id) return fallo(409, mensajes.aSiMismo);
  if (
    objetivo.rol === ROL.SUPERADMIN &&
    objetivo.activo &&
    (await deps.contarSuperadminsActivos()) <= 1
  ) {
    return fallo(409, mensajes.ultimoSuperadmin);
  }
  return null;
}

type Paso = () => Promise<ResultadoOperacion>;

/** Corre los pasos en orden y corta en el primer error. */
async function encadenar(pasos: Paso[]): Promise<Respuesta> {
  for (const paso of pasos) {
    const { error } = await paso();
    if (error) return fallo(500, MENSAJES.errorGenerico);
  }
  return ok();
}

/** El usuario, si se le puede dar de baja; si no, la respuesta de rechazo. */
async function buscarParaBaja(
  caller: PerfilDb,
  userId: string,
  mensajes: MensajesBaja,
  deps: Deps,
): Promise<Busqueda> {
  const busqueda = await buscarModificable(userId, deps);
  if (busqueda.rechazo) return busqueda;
  const rechazo = await rechazoDeBaja(caller, busqueda.objetivo, mensajes, deps);
  return rechazo ? { objetivo: null, rechazo } : busqueda;
}

async function desactivar(caller: PerfilDb, userId: string, deps: Deps): Promise<Respuesta> {
  const { rechazo } = await buscarParaBaja(caller, userId, MENSAJES_DESACTIVAR, deps);
  if (rechazo) return rechazo;
  return encadenar([() => deps.banear(userId, true), () => deps.marcarActivo(userId, false)]);
}

async function reactivar(userId: string, deps: Deps): Promise<Respuesta> {
  const { rechazo } = await buscarModificable(userId, deps);
  if (rechazo) return rechazo;
  return encadenar([() => deps.banear(userId, false), () => deps.marcarActivo(userId, true)]);
}

async function previsualizarEliminacion(userId: string, deps: Deps): Promise<Respuesta> {
  const { rechazo } = await buscarModificable(userId, deps);
  if (rechazo) return rechazo;
  const registros = await deps.contarRegistros(userId);
  return {
    status: 200,
    body: { ok: true, preview: { ...registros, modo: modoEliminacion(registros) } },
  };
}

/**
 * Orden pensado para cortes a mitad de camino: el ban va primero, así el usuario queda
 * bloqueado pase lo que pase; activo = false antes de borrar membresías evita que el
 * trigger de membresías admin se las devuelva; eliminado_en al final marca que todo se
 * completó. Hasta entonces figura como desactivado y se puede volver a eliminar.
 */
function pasosEliminacionLogica(objetivo: PerfilDb, deps: Deps): Paso[] {
  const { id } = objetivo;
  const email = emailDeEliminado(id);
  return [
    () => deps.banearParaSiempre(id),
    () => deps.marcarActivo(id, false),
    () => deps.borrarMembresias(id),
    // En un reintento el email ya puede estar reemplazado.
    ...(objetivo.email === email ? [] : [() => deps.actualizarAuth(id, { email })]),
    () => deps.marcarEliminado(id),
  ];
}

/** Las membresías van antes: su FK a auth.users no tiene cascade. */
function pasosEliminacionReal(userId: string, deps: Deps): Paso[] {
  return [() => deps.borrarMembresias(userId), () => deps.borrarUsuario(userId)];
}

async function eliminar(caller: PerfilDb, userId: string, deps: Deps): Promise<Respuesta> {
  const { objetivo, rechazo } = await buscarParaBaja(caller, userId, MENSAJES_ELIMINAR, deps);
  if (rechazo) return rechazo;
  // Se recuenta en vez de confiar en el preview: pudo sincronizar datos en el medio.
  const modo = modoEliminacion(await deps.contarRegistros(userId));
  const pasos =
    modo === MODO_ELIMINACION.logico
      ? pasosEliminacionLogica(objetivo, deps)
      : pasosEliminacionReal(userId, deps);
  return encadenar(pasos);
}

async function cambiarPassword(
  caller: PerfilDb,
  userId: string,
  password: string,
  deps: Deps,
): Promise<Respuesta> {
  const { objetivo, rechazo } = await buscarModificable(userId, deps);
  if (rechazo) return rechazo;
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
  const { objetivo, rechazo } = await buscarModificable(userId, deps);
  if (rechazo) return rechazo;
  // Mismo guard que cambiarPassword: sin él, cambiar email de otro superadmin + reenviarInvitacion = toma de cuenta.
  if (objetivo.rol === ROL.SUPERADMIN && objetivo.id !== caller.id) {
    return fallo(403, MENSAJES.emailDeOtroSuperadmin);
  }
  const cambio = await deps.actualizarAuth(userId, { email });
  return cambio.error ? falloDeAuth(cambio.error) : ok();
}

async function crear(
  cuerpo: Extract<CuerpoAdminUsers, { accion: 'crear' }>,
  deps: Deps,
): Promise<Respuesta> {
  const invitacion = await deps.invitar(cuerpo.email, { nombre: cuerpo.nombre.trim() });
  if (invitacion.error) return falloDeAuth(invitacion.error);
  // El trigger crea siempre 'tecnico'; el rol elevado se setea acá con service_role (no desde la metadata, controlable por el cliente).
  if (cuerpo.rol !== ROL.TECNICO && invitacion.userId) {
    const asignacion = await deps.asignarRol(invitacion.userId, cuerpo.rol);
    if (asignacion.error) return fallo(500, MENSAJES.errorGenerico);
  }
  return ok();
}

async function reenviarInvitacion(email: string, deps: Deps): Promise<Respuesta> {
  const envio = await deps.enviarRecuperacion(email);
  return envio.error ? falloDeAuth(envio.error) : ok();
}

async function ejecutarAccion(
  caller: PerfilDb,
  cuerpo: CuerpoAdminUsers,
  deps: Deps,
): Promise<Respuesta> {
  switch (cuerpo.accion) {
    case 'crear':
      return crear(cuerpo, deps);
    case 'reenviarInvitacion':
      return reenviarInvitacion(cuerpo.email, deps);
    case 'desactivar':
      return desactivar(caller, cuerpo.userId, deps);
    case 'reactivar':
      return reactivar(cuerpo.userId, deps);
    case 'previsualizarEliminacion':
      return previsualizarEliminacion(cuerpo.userId, deps);
    case 'eliminar':
      return eliminar(caller, cuerpo.userId, deps);
    case 'cambiarPassword':
      return cambiarPassword(caller, cuerpo.userId, cuerpo.password, deps);
    case 'cambiarEmail':
      return cambiarEmail(caller, cuerpo.userId, cuerpo.email, deps);
  }
}

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
