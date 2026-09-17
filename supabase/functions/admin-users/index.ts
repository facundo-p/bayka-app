/** Edge function admin-users (operaciones con service_role); autorización y reglas de negocio en nucleo.ts, acá se adapta HTTP e inyectan los clientes reales. */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  MENSAJES,
  ROL,
  manejarAdminUsers,
  type Deps,
  type PerfilDb,
  type RegistrosUsuario,
} from './nucleo.ts';

const CABECERAS_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** ban_duration de GoTrue: 'none' quita el ban; una duración enorme lo hace permanente pero reversible. */
const BAN_PERMANENTE = '87600h'; // ≈ 10 años
const SIN_BAN = 'none';
/** Para un eliminado: nadie lo levanta, así que la duración solo tiene que ser inalcanzable. */
const BAN_PARA_SIEMPRE = '876000h'; // ≈ 100 años

// Fail-fast: sin WEB_URL los links de invitación/recuperación apuntarían al Site URL default (flujo roto en silencio).
const WEB_URL = Deno.env.get('WEB_URL');
if (!WEB_URL) {
  throw new Error('Falta el secret WEB_URL (base de los links de establecer contraseña).');
}
const urlEstablecerPassword = `${WEB_URL}/establecer-password`;

/** Deja rastro en los logs: sin esto, todo error de Auth/DB colapsa en un 500 genérico indebuggeable. */
function conLog<T extends { error: string | null }>(operacion: string, resultado: T): T {
  if (resultado.error) console.error(`[admin-users] ${operacion}: ${resultado.error}`);
  return resultado;
}

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/** Lanza ante error de DB (un fallo transitorio no debe leerse como "usuario inexistente"). */
async function buscarPerfil(userId: string): Promise<PerfilDb | null> {
  const { data, error } = await admin
    .from('profiles')
    .select('id, nombre, rol, activo, email, eliminado_en')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Service_role no pasa por RLS: cuenta todas las filas, de cualquier plantación. */
async function contarFilas(tabla: string, columna: string, userId: string): Promise<number> {
  const { count, error } = await admin
    .from(tabla)
    .select('id', { count: 'exact', head: true })
    .eq(columna, userId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function contarRegistros(userId: string): Promise<RegistrosUsuario> {
  const [arboles, grupos, plantaciones] = await Promise.all([
    contarFilas('trees', 'usuario_registro', userId),
    contarFilas('groups', 'usuario_creador', userId),
    contarFilas('plantations', 'creado_por', userId),
  ]);
  return { arboles, grupos, plantaciones };
}

const deps: Deps = {
  perfilDelToken: async (jwt) => {
    const { data, error } = await admin.auth.getUser(jwt);
    if (error || !data.user) return null;
    return buscarPerfil(data.user.id);
  },
  buscarPerfil,
  contarSuperadminsActivos: async () => {
    const { count, error } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('rol', ROL.SUPERADMIN)
      .eq('activo', true);
    if (error) throw new Error(error.message);
    return count ?? 0;
  },
  invitar: async (email, meta) => {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: meta,
      redirectTo: urlEstablecerPassword,
    });
    return conLog('invitar', { error: error?.message ?? null, userId: data?.user?.id ?? null });
  },
  asignarRol: async (userId, rol) => {
    const { error } = await admin.from('profiles').update({ rol }).eq('id', userId);
    return conLog('asignarRol', { error: error?.message ?? null });
  },
  enviarRecuperacion: async (email) => {
    const { error } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: urlEstablecerPassword,
    });
    return conLog('enviarRecuperacion', { error: error?.message ?? null });
  },
  banear: async (userId, banear) => {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: banear ? BAN_PERMANENTE : SIN_BAN,
    });
    return conLog('banear', { error: error?.message ?? null });
  },
  actualizarAuth: async (userId, campos) => {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ...campos,
      // El cambio de email lo hace un superadmin verificado: sin doble opt-in.
      ...(campos.email ? { email_confirm: true } : {}),
    });
    return conLog('actualizarAuth', { error: error?.message ?? null });
  },
  marcarActivo: async (userId, activo) => {
    const { error } = await admin.from('profiles').update({ activo }).eq('id', userId);
    return conLog('marcarActivo', { error: error?.message ?? null });
  },
  banearParaSiempre: async (userId) => {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: BAN_PARA_SIEMPRE,
    });
    return conLog('banearParaSiempre', { error: error?.message ?? null });
  },
  marcarEliminado: async (userId) => {
    const { error } = await admin
      .from('profiles')
      .update({ eliminado_en: new Date().toISOString() })
      .eq('id', userId);
    return conLog('marcarEliminado', { error: error?.message ?? null });
  },
  contarRegistros,
  borrarMembresias: async (userId) => {
    const { error } = await admin.from('plantation_users').delete().eq('user_id', userId);
    return conLog('borrarMembresias', { error: error?.message ?? null });
  },
  borrarUsuario: async (userId) => {
    const { error } = await admin.auth.admin.deleteUser(userId);
    return conLog('borrarUsuario', { error: error?.message ?? null });
  },
};

Deno.serve(async (solicitud) => {
  if (solicitud.method === 'OPTIONS') {
    return new Response('ok', { headers: CABECERAS_CORS });
  }
  const jwt = solicitud.headers.get('Authorization')?.replace('Bearer ', '') ?? null;
  const cuerpo = await solicitud.json().catch(() => null);
  let respuesta;
  try {
    respuesta = await manejarAdminUsers(jwt, cuerpo, deps);
  } catch (error) {
    // Fallo transitorio (DB/Auth): 500 reintentable, nunca un 403/404 engañoso.
    console.error('[admin-users] excepción no controlada:', error);
    respuesta = { status: 500, body: { ok: false, error: MENSAJES.errorGenerico } };
  }
  return new Response(JSON.stringify(respuesta.body), {
    status: respuesta.status,
    headers: { ...CABECERAS_CORS, 'Content-Type': 'application/json' },
  });
});
