/** Edge function admin-plantaciones: borrado real de plantaciones y de sus fotos; reglas en nucleo.ts, acá se adapta HTTP e inyectan los clientes reales. */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  MENSAJES,
  manejarAdminPlantaciones,
  type Deps,
  type EntradaStorage,
  type PerfilDb,
  type ResultadoEliminacion,
} from './nucleo.ts';

const CABECERAS_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BUCKET_FOTOS = 'tree-photos';
/** Máximo que devuelve `list` de Storage por página. */
const PAGINA_STORAGE = 1000;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SIN_SESION = { auth: { autoRefreshToken: false, persistSession: false } };

const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, SIN_SESION);

/** Cliente que actúa como el caller: las policies y los RPC lo ven con su auth.uid(). */
function clienteDelCaller(jwt: string) {
  return createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    ...SIN_SESION,
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

function lanzarSiError(operacion: string, error: { message: string } | null): void {
  if (!error) return;
  console.error(`[admin-plantaciones] ${operacion}: ${error.message}`);
  throw new Error(error.message);
}

async function perfilDelToken(jwt: string): Promise<PerfilDb | null> {
  const { data: usuario, error } = await admin.auth.getUser(jwt);
  if (error || !usuario.user) return null;
  const { data, error: errorPerfil } = await admin
    .from('profiles')
    .select('id, rol, activo, organizacion_id')
    .eq('id', usuario.user.id)
    .maybeSingle();
  lanzarSiError('perfilDelToken', errorPerfil);
  return data
    ? { id: data.id, rol: data.rol, activo: data.activo, organizacionId: data.organizacion_id }
    : null;
}

async function eliminarPlantacion(
  jwt: string,
  plantacionId: string,
  nombreConfirmacion: string | null,
): Promise<ResultadoEliminacion> {
  const { data, error } = await clienteDelCaller(jwt).rpc('eliminar_plantacion', {
    p_id: plantacionId,
    p_nombre_confirmacion: nombreConfirmacion,
  });
  lanzarSiError('eliminarPlantacion', error);
  return data as ResultadoEliminacion;
}

/** Storage marca las carpetas con `id: null`. */
async function listarCarpeta(ruta: string): Promise<EntradaStorage[]> {
  const entradas: EntradaStorage[] = [];
  for (let offset = 0; ; offset += PAGINA_STORAGE) {
    const { data, error } = await admin.storage
      .from(BUCKET_FOTOS)
      .list(ruta, { limit: PAGINA_STORAGE, offset });
    lanzarSiError('listarCarpeta', error);
    const pagina = data ?? [];
    entradas.push(...pagina.map((item) => ({ nombre: item.name, esCarpeta: item.id === null })));
    if (pagina.length < PAGINA_STORAGE) return entradas;
  }
}

const deps: Deps = {
  perfilDelToken,
  eliminarPlantacion,
  listarCarpeta,
  borrarArchivos: async (rutas) => {
    const { error } = await admin.storage.from(BUCKET_FOTOS).remove(rutas);
    lanzarSiError('borrarArchivos', error);
  },
  marcarFotosLimpias: async (plantacionId) => {
    const { error } = await admin
      .from('plantaciones_eliminadas')
      .update({ fotos_limpias: true })
      .eq('id', plantacionId);
    lanzarSiError('marcarFotosLimpias', error);
  },
  fotosPendientes: async (organizacionId, plantacionId) => {
    let consulta = admin
      .from('plantaciones_eliminadas')
      .select('id')
      .eq('organizacion_id', organizacionId)
      .eq('fotos_limpias', false);
    if (plantacionId) consulta = consulta.eq('id', plantacionId);
    const { data, error } = await consulta;
    lanzarSiError('fotosPendientes', error);
    return (data ?? []).map((fila) => fila.id as string);
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
    respuesta = await manejarAdminPlantaciones(jwt, cuerpo, deps);
  } catch (error) {
    console.error('[admin-plantaciones] excepción no controlada:', error);
    respuesta = { status: 500, body: { ok: false, error: MENSAJES.errorGenerico } };
  }
  return new Response(JSON.stringify(respuesta.body), {
    status: respuesta.status,
    headers: { ...CABECERAS_CORS, 'Content-Type': 'application/json' },
  });
});
