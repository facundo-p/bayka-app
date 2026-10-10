import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useCerrarConEscape } from '../hooks/useCerrarConEscape';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { cx } from '../lib/classNames';
import { TECLA } from '../lib/teclas';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  /** `hoja`: pegada al borde de abajo y a ancho completo, para el teléfono. */
  posicion?: 'centro' | 'hoja';
  /** `amplio`: para mostrar una imagen grande, ej. la foto de un árbol. */
  ancho?: 'normal' | 'amplio';
  children: ReactNode;
}

/** Enfoca el dialog al abrir y, al cerrar, devuelve el foco a lo que lo tenía antes. */
function useFocusOnOpen(open: boolean): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus();
    return () => previo?.focus();
  }, [open]);
  return ref;
}

/** El Escape de adentro cierra solo el modal: no llega al panel o pantalla de atrás. */
function useTeclado(onClose: () => void, atraparFoco: (evento: KeyboardEvent) => void) {
  return (evento: KeyboardEvent) => {
    if (evento.key !== TECLA.escape) return atraparFoco(evento);
    evento.stopPropagation();
    onClose();
  };
}

export function Modal({
  open,
  title,
  onClose,
  posicion = 'centro',
  ancho = 'normal',
  children,
}: ModalProps) {
  const dialogRef = useFocusOnOpen(open);
  const alTeclear = useTeclado(onClose, useFocusTrap(dialogRef));
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
        className={cx(styles.dialog, esHoja && styles.dialogHoja, styles[ancho])}
        onKeyDown={alTeclear}
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
