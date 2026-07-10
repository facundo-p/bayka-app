/**
 * Edge function admin-users: operaciones privilegiadas del ABM de usuarios
 * (invitación, ban, contraseña, email) que requieren service_role y por eso
 * no pueden vivir en el cliente web. La autorización (solo superadmin activo)
 * y las reglas de negocio están en nucleo.ts; acá solo se adapta HTTP y se
 * inyectan los clientes reales.
 *
 * Deploy y secrets: ver supabase/functions/README.md
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { manejarAdminUsers, type Deps, type PerfilDb } from './nucleo.ts';

const CABECERAS_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/** Destino de los links de invitación/recuperación (pantalla pública web). */
const urlEstablecerPassword = `${Deno.env.get('WEB_URL') ?? ''}/establecer-password`;

async function buscarPerfil(userId: string): Promise<PerfilDb | null> {
  const { data } = await admin
    .from('profiles')
    .select('id, nombre, rol, activo')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

const deps: Deps = {
  perfilDelToken: async (jwt) => {
    const { data, error } = await admin.auth.getUser(jwt);
    if (error || !data.user) return null;
    return buscarPerfil(data.user.id);
  },
  buscarPerfil,
  contarSuperadminsActivos: async () => {
    const { count } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('rol', 'superadmin')
      .eq('activo', true);
    return count ?? 0;
  },
  invitar: async (email, meta) => {
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: meta,
      redirectTo: urlEstablecerPassword,
    });
    return { error: error?.message ?? null };
  },
  enviarRecuperacion: async (email) => {
    const { error } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: urlEstablecerPassword,
    });
    return { error: error?.message ?? null };
  },
  banear: async (userId, banear) => {
    // '87600h' ≈ 10 años: ban efectivamente permanente pero reversible.
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: banear ? '87600h' : 'none',
    });
    return { error: error?.message ?? null };
  },
  actualizarAuth: async (userId, campos) => {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ...campos,
      // El cambio de email lo hace un superadmin verificado: sin doble opt-in.
      ...(campos.email ? { email_confirm: true } : {}),
    });
    return { error: error?.message ?? null };
  },
  marcarActivo: async (userId, activo) => {
    const { error } = await admin.from('profiles').update({ activo }).eq('id', userId);
    return { error: error?.message ?? null };
  },
};

Deno.serve(async (solicitud) => {
  if (solicitud.method === 'OPTIONS') {
    return new Response('ok', { headers: CABECERAS_CORS });
  }
  const jwt = solicitud.headers.get('Authorization')?.replace('Bearer ', '') ?? null;
  const cuerpo = await solicitud.json().catch(() => null);
  const respuesta = await manejarAdminUsers(jwt, cuerpo, deps);
  return new Response(JSON.stringify(respuesta.body), {
    status: respuesta.status,
    headers: { ...CABECERAS_CORS, 'Content-Type': 'application/json' },
  });
});
