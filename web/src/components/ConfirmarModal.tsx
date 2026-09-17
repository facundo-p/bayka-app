import type { ReactNode } from 'react';
import {
  useConfirmacion,
  type EstadoConfirmacion,
  type OpcionesConfirmacion,
} from '../hooks/useConfirmacion';
import { Button } from './Button';
import { AccionesModal, ErrorEnvio } from './FormularioModal';
import { Modal } from './Modal';
import styles from './Formulario.module.css';

interface ConfirmarModalProps extends OpcionesConfirmacion {
  titulo: string;
  descripcion: string;
  confirmarEtiqueta: string;
  destructiva?: boolean;
  /** Contenido extra entre la descripción y los botones, p. ej. un campo a completar. */
  children?: ReactNode;
  /** Advertencia destacada debajo de la descripción (qué se pierde, si es irreversible). */
  aviso?: string;
  /** Deshabilita confirmar hasta que se cumpla una condición del caller. */
  deshabilitada?: boolean;
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
      {modal.children}
      {modal.aviso && <p className={styles.advertencia}>{modal.aviso}</p>}
      <ErrorEnvio mensaje={estado.error} />
      <AccionesModal onCancelar={modal.onClose}>
        <Button
          type="button"
          variant={modal.destructiva ? 'danger' : 'primary'}
          loading={estado.confirmando}
          disabled={modal.deshabilitada}
          onClick={estado.confirmar}
        >
          {modal.confirmarEtiqueta}
        </Button>
      </AccionesModal>
    </>
  );
}

/** Confirmación genérica: describe el efecto, ejecuta y corre `alCompletar`.
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
