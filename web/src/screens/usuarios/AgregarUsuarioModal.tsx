import { Button, Modal, Select } from '../../components';
import { ROL, type Rol } from '../../repositories/profileRepository';
import { AccionesModal, AvisoSuperadmin, CamposContacto, ErrorEnvio } from './formulario';
import { OPCIONES_ROL } from './presentacion';
import { useAltaUsuario, type AltaUsuario } from './useAltaUsuario';
import styles from './ModalUsuarios.module.css';

const NOTA_INVITACION = 'Le va a llegar un email para definir su contraseña.';

function CuerpoAgregarUsuario({ alta }: { alta: AltaUsuario }) {
  return (
    <>
      <CamposContacto campos={alta} emailRequerido />
      <Select
        label="Rol"
        value={alta.valores.rol}
        onChange={(evento) => alta.cambiar('rol', evento.target.value as Rol)}
        opciones={OPCIONES_ROL}
      />
      {alta.valores.rol === ROL.SUPERADMIN && <AvisoSuperadmin />}
      <p className={styles.info}>{NOTA_INVITACION}</p>
      <ErrorEnvio mensaje={alta.errorEnvio} />
    </>
  );
}

/** Alta por invitación: crea el usuario vía la edge function admin-users y
 *  Supabase le envía el email para definir su contraseña. */
export function AgregarUsuarioModal({ onClose }: { onClose: () => void }) {
  const alta = useAltaUsuario(onClose);
  return (
    <Modal open title="Agregar usuario" onClose={onClose}>
      <form className={styles.form} onSubmit={alta.enviar}>
        <CuerpoAgregarUsuario alta={alta} />
        <AccionesModal onCancelar={onClose}>
          <Button type="submit" disabled={!alta.valido} loading={alta.enviando}>
            Enviar invitación
          </Button>
        </AccionesModal>
      </form>
    </Modal>
  );
}
