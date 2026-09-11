import { Button, Modal, PasswordInput } from '../../components';
import { nombreVisible } from '../../lib/presentacionUsuario';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import { AccionesModal, ErrorEnvio } from './formulario';
import { useCambioPassword, type CambioPassword } from './useCambioPassword';
import styles from './ModalUsuarios.module.css';

const NOTA_PASSWORD = 'La persona va a poder ingresar de inmediato con la contraseña nueva.';

function CamposPassword({ cambio }: { cambio: CambioPassword }) {
  return (
    <>
      <PasswordInput
        label="Contraseña nueva"
        autoComplete="new-password"
        required
        value={cambio.password}
        onChange={(evento) => cambio.setPassword(evento.target.value)}
      />
      <PasswordInput
        label="Repetir contraseña"
        autoComplete="new-password"
        required
        value={cambio.confirmacion}
        onChange={(evento) => cambio.setConfirmacion(evento.target.value)}
      />
    </>
  );
}

interface CambiarPasswordModalProps {
  usuario: UsuarioConAsignaciones;
  onClose: () => void;
}

export function CambiarPasswordModal({ usuario, onClose }: CambiarPasswordModalProps) {
  const cambio = useCambioPassword(usuario.id, onClose);
  const nombre = nombreVisible(usuario.nombre, usuario.id);
  return (
    <Modal open title={`Cambiar contraseña de ${nombre}`} onClose={onClose}>
      <form className={styles.form} onSubmit={cambio.enviar}>
        <CamposPassword cambio={cambio} />
        <p className={styles.info}>{NOTA_PASSWORD}</p>
        <ErrorEnvio mensaje={cambio.error} />
        <AccionesModal onCancelar={onClose}>
          <Button type="submit" loading={cambio.guardando}>
            Guardar contraseña
          </Button>
        </AccionesModal>
      </form>
    </Modal>
  );
}
