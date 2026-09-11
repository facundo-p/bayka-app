/**
 * Valores de los formularios de alta y edición de una persona. Puro: se
 * testea sin renderizar.
 */
import { emailValido } from '../../../../supabase/functions/admin-users/nucleo';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import { ROL, type Rol } from '../../repositories/profileRepository';
import type { CambiosUsuario } from '../../services/edicionUsuario';

export interface ValoresUsuario {
  nombre: string;
  email: string;
  rol: Rol;
}

/** Los campos que se tipean; el rol va por selector. */
export type CampoTexto = Exclude<keyof ValoresUsuario, 'rol'>;

/** El alta arranca vacía y como técnico, el rol de menor alcance. */
export const VALORES_ALTA: ValoresUsuario = { nombre: '', email: '', rol: ROL.TECNICO };

export function valoresDeUsuario(usuario: UsuarioConAsignaciones): ValoresUsuario {
  return { nombre: usuario.nombre, email: usuario.email ?? '', rol: usuario.rol };
}

/** Sin espacios en los bordes: así se comparan y se envían. */
export function normalizar({ nombre, email, rol }: ValoresUsuario): ValoresUsuario {
  return { nombre: nombre.trim(), email: email.trim(), rol };
}

export function altaValida(valores: ValoresUsuario): boolean {
  const { nombre, email } = normalizar(valores);
  return nombre !== '' && emailValido(email);
}

/** Lo que difiere de la persona. El rol cuenta solo si su guard deja cambiarlo. */
export function cambiosDeEdicion(
  usuario: UsuarioConAsignaciones,
  valores: ValoresUsuario,
  rolEditable: boolean,
): CambiosUsuario {
  const { nombre, email, rol } = normalizar(valores);
  return {
    ...(nombre === usuario.nombre ? {} : { nombre }),
    ...(email === (usuario.email ?? '') ? {} : { email }),
    ...(rolEditable && rol !== usuario.rol ? { rol } : {}),
  };
}

/** Con nombre, algún cambio y, si cambió el email, uno válido. */
export function edicionValida(valores: ValoresUsuario, cambios: CambiosUsuario): boolean {
  if (valores.nombre.trim() === '' || Object.keys(cambios).length === 0) return false;
  return cambios.email === undefined || emailValido(cambios.email);
}
