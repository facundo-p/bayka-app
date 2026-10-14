/** Piezas que repiten los modales con formulario o confirmación. */
import type { ReactNode } from 'react';
import { Button } from './Button';
import styles from './Formulario.module.css';

interface ErrorEnvioProps {
  mensaje: string | null;
  className?: string;
}

/** El error del último envío; sin error no ocupa lugar. */
export function ErrorEnvio({ mensaje, className = styles.errorEnvio }: ErrorEnvioProps) {
  if (!mensaje) return null;
  return (
    <p className={className} role="alert">
      {mensaje}
    </p>
  );
}

interface AccionesModalProps {
  onCancelar: () => void;
  /** Mientras corre algo que no se puede cortar. */
  cancelarDeshabilitado?: boolean;
  /** La acción principal, a la derecha de Cancelar. */
  children: ReactNode;
}

/** Pie de los modales: Cancelar y la acción principal. */
export function AccionesModal({
  onCancelar,
  cancelarDeshabilitado = false,
  children,
}: AccionesModalProps) {
  return (
    <div className={styles.acciones}>
      <Button
        type="button"
        variant="secondary"
        disabled={cancelarDeshabilitado}
        onClick={onCancelar}
      >
        Cancelar
      </Button>
      {children}
    </div>
  );
}
