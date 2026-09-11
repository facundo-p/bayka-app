/**
 * Filtro del listado de usuarios. Puro: se testea sin renderizar.
 */
import { nombreVisible } from '../../lib/presentacionUsuario';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import { ROL } from '../../repositories/profileRepository';

export const FILTRO_ROL = {
  todos: 'todos',
  admins: 'admins',
  tecnicos: 'tecnicos',
} as const;

export type FiltroRol = (typeof FILTRO_ROL)[keyof typeof FILTRO_ROL];

export const FILTRO_ESTADO = {
  todos: 'todos',
  activos: 'activos',
  inactivos: 'inactivos',
} as const;

export type FiltroEstado = (typeof FILTRO_ESTADO)[keyof typeof FILTRO_ESTADO];

export type FiltrosUsuarios = {
  busqueda: string;
  rol: FiltroRol;
  estado: FiltroEstado;
};

/** Los filtros de la barra, sin el texto del buscador. */
export type FiltrosBarraUsuarios = Omit<FiltrosUsuarios, 'busqueda'>;

export const FILTROS_INICIALES_USUARIOS: FiltrosBarraUsuarios = {
  rol: FILTRO_ROL.todos,
  estado: FILTRO_ESTADO.todos,
};

/** Coincidencia case-insensitive contra nombre y email. */
function coincide(usuario: UsuarioConAsignaciones, termino: string): boolean {
  const aguja = termino.trim().toLowerCase();
  if (!aguja) return true;
  return [nombreVisible(usuario.nombre, usuario.id), usuario.email ?? ''].some((campo) =>
    campo.toLowerCase().includes(aguja),
  );
}

/** "Admins" agrupa admin+superadmin: los dos tienen acceso de gestión. */
function pasaRol(usuario: UsuarioConAsignaciones, filtro: FiltroRol): boolean {
  if (filtro === FILTRO_ROL.admins) {
    return usuario.rol === ROL.ADMIN || usuario.rol === ROL.SUPERADMIN;
  }
  if (filtro === FILTRO_ROL.tecnicos) return usuario.rol === ROL.TECNICO;
  return true;
}

function pasaEstado(usuario: UsuarioConAsignaciones, filtro: FiltroEstado): boolean {
  if (filtro === FILTRO_ESTADO.activos) return usuario.activo;
  if (filtro === FILTRO_ESTADO.inactivos) return !usuario.activo;
  return true;
}

export function filtrarUsuarios(
  usuarios: UsuarioConAsignaciones[],
  { busqueda, rol, estado }: FiltrosUsuarios,
): UsuarioConAsignaciones[] {
  return usuarios.filter(
    (usuario) =>
      coincide(usuario, busqueda) && pasaRol(usuario, rol) && pasaEstado(usuario, estado),
  );
}

/**
 * Resumen de plantaciones de la columna: superadmin y admin son miembros
 * automáticos de todas (#67); el resto muestra su conteo de asignaciones.
 */
export function resumenPlantaciones(usuario: UsuarioConAsignaciones): string {
  if (usuario.rol === ROL.SUPERADMIN || usuario.rol === ROL.ADMIN) return 'Todas';
  if (usuario.plantacionesAsignadas === 0) return 'Sin plantaciones';
  const plural = usuario.plantacionesAsignadas === 1 ? 'plantación' : 'plantaciones';
  return `${usuario.plantacionesAsignadas} ${plural}`;
}

/** Meta de la cabecera con los conteos por rol; pluraliza "persona(s)". */
export function calcularMeta(usuarios: UsuarioConAsignaciones[]): string {
  const superadmins = usuarios.filter((usuario) => usuario.rol === ROL.SUPERADMIN).length;
  const admins = usuarios.filter((usuario) => usuario.rol === ROL.ADMIN).length;
  const tecnicos = usuarios.filter((usuario) => usuario.rol === ROL.TECNICO).length;
  const personas = usuarios.length === 1 ? 'persona' : 'personas';
  return (
    `${usuarios.length} ${personas} · ${superadmins} superadmin · ` +
    `${admins} ${admins === 1 ? 'admin' : 'admins'} · ` +
    `${tecnicos} ${tecnicos === 1 ? 'técnico' : 'técnicos'}`
  );
}

export function contarActivas(usuarios: UsuarioConAsignaciones[]): number {
  return usuarios.filter((usuario) => usuario.activo).length;
}
