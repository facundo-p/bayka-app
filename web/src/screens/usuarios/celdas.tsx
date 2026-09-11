import { cx } from '../../lib/classNames';
import { iniciales } from '../../lib/iniciales';
import { nombreVisible } from '../../lib/presentacionUsuario';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import { ROL, type Rol } from '../../repositories/profileRepository';
import { itemsDeMenu, type AccionActiva, type ContextoAcciones } from './acciones';
import { MenuAccionesUsuario } from './MenuAccionesUsuario';
import styles from './Usuarios.module.css';

/** Clase del avatar según rol (mismos tripletes que el Badge de rol). */
const CLASE_AVATAR_ROL: Record<Rol, string> = {
  [ROL.SUPERADMIN]: styles.avatarSuperadmin,
  [ROL.ADMIN]: styles.avatarAdmin,
  [ROL.TECNICO]: styles.avatarTecnico,
};

/** Iniciales sobre el color del rol; el tamaño lo pone quien la usa. */
export function Avatar({
  usuario,
  clase = styles.avatar,
}: {
  usuario: UsuarioConAsignaciones;
  clase?: string;
}) {
  return (
    <span className={cx(clase, CLASE_AVATAR_ROL[usuario.rol])} aria-hidden>
      {iniciales(nombreVisible(usuario.nombre, usuario.id))}
    </span>
  );
}

/** Identidad de la fila: avatar con iniciales + nombre y línea secundaria. */
export function CeldaUsuario({ usuario }: { usuario: UsuarioConAsignaciones }) {
  return (
    <div className={cx(styles.usuario, !usuario.activo && styles.inactivo)}>
      <Avatar usuario={usuario} />
      <span className={styles.usuarioTexto}>
        <span className={styles.nombre}>{nombreVisible(usuario.nombre, usuario.id)}</span>
        {/* Email como identificador secundario; perfiles previos al backfill
            de la migración 026 caen a la organización. */}
        {(usuario.email ?? usuario.organizacionNombre) && (
          <span className={styles.organizacion}>{usuario.email ?? usuario.organizacionNombre}</span>
        )}
      </span>
    </div>
  );
}

/** Texto de una celda simple, atenuado cuando la persona está inactiva. */
export function CeldaTexto({
  usuario,
  texto,
  clase,
}: {
  usuario: UsuarioConAsignaciones;
  texto: string;
  clase?: string;
}) {
  return <span className={cx(clase, !usuario.activo && styles.textoInactivo)}>{texto}</span>;
}

interface CeldaAccionesProps {
  usuario: UsuarioConAsignaciones;
  contexto: ContextoAcciones;
  onAccion: (activa: AccionActiva) => void;
}

/** El menú "⋯" de la fila. */
export function CeldaAcciones({ usuario, contexto, onAccion }: CeldaAccionesProps) {
  return (
    // La fila abre el panel: el menú frena el click para no hacer las dos cosas.
    <span onClick={(evento) => evento.stopPropagation()}>
      <MenuAccionesUsuario
        nombre={nombreVisible(usuario.nombre, usuario.id)}
        items={itemsDeMenu(usuario, contexto.idActual, contexto.superadminsActivos)}
        onAccion={(accion) => onAccion({ usuario, accion })}
      />
    </span>
  );
}
