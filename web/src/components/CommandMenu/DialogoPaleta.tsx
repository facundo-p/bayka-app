import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cerrarSoloEstaCapa } from '../../lib/escape';
import { TECLA } from '../../lib/teclas';
import { useBloquearScroll } from '../../hooks/useBloquearScroll';
import { useFocusTrap } from '../../hooks/useFocusTrap';
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
    if (cerrarSoloEstaCapa(evento, onCerrar)) return;
    if (evento.key === TECLA.tab) atraparFoco(evento);
    else onTecla(evento);
  };
  return { refDialog, alPresionar };
}

/**
 * Diálogo modal sobre un overlay: el click afuera y Escape cierran, Tab no se
 * escapa y el fondo no scrollea.
 */
export function DialogoPaleta({ onCerrar, onTecla, children }: DialogoPaletaProps) {
  const { refDialog, alPresionar } = useTeclasDialogo({ onCerrar, onTecla });
  // Se monta solo con la paleta abierta.
  useBloquearScroll(true);
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
