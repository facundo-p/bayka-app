import { nombreVisible } from '../../lib/presentacionUsuario';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import { ACCION_USUARIO, type AccionUsuario } from './acciones';
import { CambiarPasswordModal } from './CambiarPasswordModal';
import { ConfirmarModal } from './ConfirmarModal';
import { CONFIRMACION_POR_ACCION } from './confirmaciones';
import { EliminarUsuarioModal } from './EliminarUsuarioModal';

interface ModalDeAccionProps {
  usuario: UsuarioConAsignaciones;
  accion: AccionUsuario;
  onClose: () => void;
}

/** El modal de una acción rápida: el formulario de contraseña, la eliminación o la confirmación. */
export function ModalDeAccion({ usuario, accion, onClose }: ModalDeAccionProps) {
  if (accion === ACCION_USUARIO.cambiarPassword) {
    return <CambiarPasswordModal usuario={usuario} onClose={onClose} />;
  }
  if (accion === ACCION_USUARIO.eliminar) {
    return <EliminarUsuarioModal usuario={usuario} onClose={onClose} />;
  }
  const confirmacion = CONFIRMACION_POR_ACCION[accion];
  const nombre = nombreVisible(usuario.nombre, usuario.id);
  return (
    <ConfirmarModal
      titulo={confirmacion.titulo(nombre)}
      descripcion={confirmacion.descripcion(nombre, usuario)}
      confirmarEtiqueta={confirmacion.etiqueta}
      destructiva={confirmacion.destructiva}
      accion={() => confirmacion.servicio(usuario)}
      textoExito={confirmacion.textoExito}
      onClose={onClose}
    />
  );
}
