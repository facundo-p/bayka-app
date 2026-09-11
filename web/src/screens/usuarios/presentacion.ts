/** Constantes de presentación compartidas por la pantalla y los modales de usuarios. */
import type { Opcion } from '../../components/opcion';
import { etiquetaRol } from '../../lib/presentacionUsuario';
import { ROL, type Rol } from '../../repositories/profileRepository';

export const ADVERTENCIA_SUPERADMIN = 'Va a tener acceso total, incluida la gestión de usuarios.';

/** De menor a mayor alcance: el orden del selector de rol. */
const ORDEN_ROLES: readonly Rol[] = [ROL.TECNICO, ROL.ADMIN, ROL.SUPERADMIN];

export const OPCIONES_ROL: ReadonlyArray<Opcion<Rol>> = ORDEN_ROLES.map((rol) => ({
  value: rol,
  label: etiquetaRol(rol),
}));
