import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { TECLA } from '../../lib/teclas';
import { useFocusTrap } from './useFocusTrap';
import styles from './CommandMenu.module.css';

interface DialogoPaletaProps {
  onCerrar: () => void;
  /** Las teclas que no son Escape ni Tab: la navegación del listbox. */
  onTecla: (evento: KeyboardEvent) => void;
  children: ReactNode;
}

function useTeclasDialogo({ onCerrar, onTecla }: Omit<DialogoPaletaProps, 'children'>) {
  const refDialog = useRef<HTMLDivElement>(null);
  const atraparFoco = useFocusTrap(refDialog);
  const alPresionar = (evento: KeyboardEvent) => {
    if (evento.key === TECLA.escape) onCerrar();
    else if (evento.key === TECLA.tab) atraparFoco(evento);
    else onTecla(evento);
  };
  return { refDialog, alPresionar };
}

/** Diálogo modal sobre un overlay: el click afuera y Escape cierran, y Tab no se escapa. */
export function DialogoPaleta({ onCerrar, onTecla, children }: DialogoPaletaProps) {
  const { refDialog, alPresionar } = useTeclasDialogo({ onCerrar, onTecla });
  return (
    <div className={styles.overlay} onClick={onCerrar}>
      <div
        ref={refDialog}
        role="dialog"
        aria-modal="true"
        aria-label="Buscar"
        className={styles.dialog}
        onClick={(evento) => evento.stopPropagation()}
        onKeyDown={alPresionar}
      >
        {children}
      </div>
    </div>
  );
}
