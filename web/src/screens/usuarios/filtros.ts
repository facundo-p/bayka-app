/**
 * Filtro del listado de usuarios. Puro: se testea sin renderizar.
 */
import { pluralizar, type Sustantivo } from '../../lib/formato';
import { nombreVisible } from '../../lib/presentacionUsuario';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import { ROL, type Rol } from '../../repositories/profileRepository';

/** Cómo cuenta cada rol la meta de la cabecera. */
const SUSTANTIVO_ROL = {
  [ROL.SUPERADMIN]: { singular: 'superadmin', plural: 'superadmins' },
  [ROL.ADMIN]: { singular: 'admin', plural: 'admins' },
  [ROL.TECNICO]: { singular: 'técnico', plural: 'técnicos' },
} as const satisfies Record<Rol, Sustantivo>;

const ROLES_EN_META: readonly Rol[] = [ROL.SUPERADMIN, ROL.ADMIN, ROL.TECNICO];

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
  return pluralizar(usuario.plantacionesAsignadas, SUSTANTIVO.plantacion);
}

function contarRol(usuarios: UsuarioConAsignaciones[], rol: Rol): number {
  return usuarios.filter((usuario) => usuario.rol === rol).length;
}

/** Meta de la cabecera: el total de personas y cuántas hay de cada rol. */
export function calcularMeta(usuarios: UsuarioConAsignaciones[]): string {
  const porRol = ROLES_EN_META.map((rol) =>
    pluralizar(contarRol(usuarios, rol), SUSTANTIVO_ROL[rol]),
  );
  return [pluralizar(usuarios.length, SUSTANTIVO.persona), ...porRol].join(' · ');
}

export function contarActivas(usuarios: UsuarioConAsignaciones[]): number {
  return usuarios.filter((usuario) => usuario.activo).length;
}
