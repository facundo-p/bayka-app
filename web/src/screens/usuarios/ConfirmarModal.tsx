import { Button, Modal } from '../../components';
import { AccionesModal, ErrorEnvio } from './formulario';
import {
  useConfirmacion,
  type EstadoConfirmacion,
  type OpcionesConfirmacion,
} from './useConfirmacion';
import styles from './ModalUsuarios.module.css';

interface ConfirmarModalProps extends OpcionesConfirmacion {
  titulo: string;
  descripcion: string;
  confirmarEtiqueta: string;
  destructiva?: boolean;
}

/** Terminada la acción: el resultado y un solo botón para cerrar. */
function ResultadoConfirmacion({ texto, onClose }: { texto: string; onClose: () => void }) {
  return (
    <>
      <p className={styles.info} role="status">
        {texto}
      </p>
      <div className={styles.acciones}>
        <Button type="button" onClick={onClose}>
          Listo
        </Button>
      </div>
    </>
  );
}

interface PreguntaConfirmacionProps {
  modal: ConfirmarModalProps;
  estado: EstadoConfirmacion;
}

function PreguntaConfirmacion({ modal, estado }: PreguntaConfirmacionProps) {
  return (
    <>
      <p className={styles.info}>{modal.descripcion}</p>
      <ErrorEnvio mensaje={estado.error} />
      <AccionesModal onCancelar={modal.onClose}>
        <Button
          type="button"
          variant={modal.destructiva ? 'danger' : 'primary'}
          loading={estado.confirmando}
          onClick={estado.confirmar}
        >
          {modal.confirmarEtiqueta}
        </Button>
      </AccionesModal>
    </>
  );
}

/** Confirmación genérica para acciones de usuario (desactivar, reactivar,
 *  reenviar invitación): describe el efecto, ejecuta y refresca el listado.
 *  Con textoExito, al terminar muestra el resultado en lugar de cerrarse. */
export function ConfirmarModal(props: ConfirmarModalProps) {
  const estado = useConfirmacion(props);
  const { titulo, textoExito, onClose } = props;
  return (
    <Modal open title={titulo} onClose={onClose}>
      <div className={styles.form}>
        {estado.completada && textoExito ? (
          <ResultadoConfirmacion texto={textoExito} onClose={onClose} />
        ) : (
          <PreguntaConfirmacion modal={props} estado={estado} />
        )}
      </div>
    </Modal>
  );
}
