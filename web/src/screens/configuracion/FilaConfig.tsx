import type { ReactNode } from 'react';
import styles from './SeccionesConfig.module.css';

interface FilaConfigProps {
  etiqueta: string;
  ayuda: string;
  /** El control de la fila (toggle, segmentado, input). */
  children: ReactNode;
}

/** Fila de ajuste: qué hace a la izquierda, con qué se cambia a la derecha. */
export function FilaConfig({ etiqueta, ayuda, children }: FilaConfigProps) {
  return (
    <div className={styles.filaConfig}>
      <div className={styles.filaConfigTexto}>
        <p className={styles.etiqueta}>{etiqueta}</p>
        <p className={styles.textoAyuda}>{ayuda}</p>
      </div>
      <div className={styles.filaConfigControl}>{children}</div>
    </div>
  );
}
