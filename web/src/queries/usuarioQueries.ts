import { supabase } from '../lib/supabase';
import { ROL, type Rol } from '../repositories/profileRepository';
import { leerPaginado } from './leerPaginado';

/** Rol del usuario dentro de una plantación (columna `rol_en_plantacion`):
 *  los roles globales salvo superadmin (que no aplica a nivel plantación). */
export type RolEnPlantacion = Exclude<Rol, typeof ROL.SUPERADMIN>;

export type PerfilResumen = {
  id: string;
  nombre: string;
  rol: Rol;
};

export type UsuarioAsignado = {
  userId: string;
  nombre: string;
  rolGlobal: Rol;
  rolEnPlantacion: RolEnPlantacion;
  assignedAt: string;
};

export type UsuarioConAsignaciones = {
  id: string;
  nombre: string;
  rol: Rol;
  /** Copia sincronizada desde Auth (migración 026); null en perfiles previos al backfill. */
  email: string | null;
  /** false = baja reversible (soft-delete); el ban real vive en Auth. */
  activo: boolean;
  organizacionId: string | null;
  organizacionNombre: string;
  plantacionesAsignadas: number;
  createdAt: string;
};

/** Fila del join plantation_users → profiles (embed de PostgREST). */
type FilaAsignado = {
  user_id: string;
  rol_en_plantacion: RolEnPlantacion;
  assigned_at: string;
  profiles: { nombre: string | null; rol: Rol } | null;
};

type FilaUsuario = {
  id: string;
  nombre: string | null;
  rol: Rol;
  email: string | null;
  activo: boolean;
  organizacion_id: string | null;
  created_at: string;
};

/** Todos los perfiles visibles (la RLS acota a la organización), por nombre. */
export async function listarPerfiles(): Promise<PerfilResumen[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, rol')
    .order('nombre', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PerfilResumen[];
}

/**
 * Cuenta plantaciones asignadas por usuario en una sola lectura: trae los
 * user_id de plantation_users y agrega en cliente con un Map (mismo patrón
 * que el conteo de árboles por grupo en dataExplorerQueries).
 */
async function contarAsignacionesPorUsuario(): Promise<Map<string, number>> {
  const filas = await leerPaginado<{ user_id: string }>((desde, hasta) =>
    supabase.from('plantation_users').select('user_id').range(desde, hasta),
  );
  const conteos = new Map<string, number>();
  for (const fila of filas) {
    conteos.set(fila.user_id, (conteos.get(fila.user_id) ?? 0) + 1);
  }
  return conteos;
}

/** Nombres de organización por id, para resolver la columna en cliente. */
async function mapearNombresDeOrganizaciones(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('organizations').select('id, nombre');
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as Array<{ id: string; nombre: string }>;
  return new Map(filas.map((organizacion) => [organizacion.id, organizacion.nombre]));
}

function mapearUsuario(
  fila: FilaUsuario,
  asignaciones: Map<string, number>,
  organizaciones: Map<string, string>,
): UsuarioConAsignaciones {
  return {
    id: fila.id,
    nombre: fila.nombre ?? '',
    rol: fila.rol,
    email: fila.email,
    activo: fila.activo,
    organizacionId: fila.organizacion_id,
    organizacionNombre: fila.organizacion_id
      ? (organizaciones.get(fila.organizacion_id) ?? '')
      : '',
    plantacionesAsignadas: asignaciones.get(fila.id) ?? 0,
    createdAt: fila.created_at,
  };
}

/** Perfiles con organización y count de plantaciones asignadas, por nombre. */
export async function listarUsuariosConAsignaciones(): Promise<UsuarioConAsignaciones[]> {
  const [{ data, error }, asignaciones, organizaciones] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, nombre, rol, email, activo, organizacion_id, created_at')
      .order('nombre', { ascending: true }),
    contarAsignacionesPorUsuario(),
    mapearNombresDeOrganizaciones(),
  ]);
  if (error) throw new Error(error.message);
  return ((data ?? []) as FilaUsuario[]).map((fila) =>
    mapearUsuario(fila, asignaciones, organizaciones),
  );
}

function mapearAsignado(fila: FilaAsignado): UsuarioAsignado {
  return {
    userId: fila.user_id,
    nombre: fila.profiles?.nombre ?? '',
    rolGlobal: fila.profiles?.rol ?? ROL.TECNICO,
    rolEnPlantacion: fila.rol_en_plantacion,
    assignedAt: fila.assigned_at,
  };
}

/** Usuarios asignados a la plantación con su perfil, por orden de asignación. */
export async function listarAsignados(plantationId: string): Promise<UsuarioAsignado[]> {
  const { data, error } = await supabase
    .from('plantation_users')
    .select('user_id, rol_en_plantacion, assigned_at, profiles(nombre, rol)')
    .eq('plantation_id', plantationId)
    .order('assigned_at', { ascending: true });
  if (error) throw new Error(error.message);
  // El cliente sin typegen tipa el embed como array, pero la FK user_id →
  // profiles es many-to-one: en runtime llega un objeto.
  return ((data ?? []) as unknown as FilaAsignado[]).map(mapearAsignado);
}
