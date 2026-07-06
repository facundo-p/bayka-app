import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

function useCloseOnEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);
}

function useFocusOnOpen(open: boolean): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  return ref;
}

export function Modal({ open, title, onClose, children }: ModalProps) {
  const dialogRef = useFocusOnOpen(open);
  useCloseOnEscape(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={styles.dialog}
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
