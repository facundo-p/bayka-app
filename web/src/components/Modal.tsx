import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useCerrarConEscape } from '../hooks/useCerrarConEscape';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { cx } from '../lib/classNames';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  /** `hoja`: pegada al borde de abajo y a ancho completo, para el teléfono. */
  posicion?: 'centro' | 'hoja';
  children: ReactNode;
}

function useFocusOnOpen(open: boolean): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  return ref;
}

export function Modal({ open, title, onClose, posicion = 'centro', children }: ModalProps) {
  const dialogRef = useFocusOnOpen(open);
  const atraparFoco = useFocusTrap(dialogRef);
  useCerrarConEscape(open, onClose);
  if (!open) return null;
  const esHoja = posicion === 'hoja';
  return createPortal(
    <div className={cx(styles.overlay, esHoja && styles.overlayHoja)} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(styles.dialog, esHoja && styles.dialogHoja)}
        onKeyDown={atraparFoco}
        /* El click dentro de la card no debe cerrar el modal. */
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className={styles.title}>{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
