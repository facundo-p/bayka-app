import type { ReactNode } from 'react';
import styles from './SeccionesConfig.module.css';

interface CabeceraConfigProps {
  titulo: string;
  subtitulo: string;
  /** Chip a la derecha del título (ej. "8 habilitadas"). */
  chip?: string;
  /** Controles de la card (buscador, maestro, "+ Asignar"), en la misma línea. */
  acciones?: ReactNode;
}

/** Cabecera común de las cards de Configuración: título + subtítulo + controles,
 *  todo en un renglón para que el cuerpo se quede con el alto. */
export function CabeceraConfig({ titulo, subtitulo, chip, acciones }: CabeceraConfigProps) {
  return (
    <header className={styles.cabecera}>
      <h2 className={styles.titulo}>{titulo}</h2>
      <p className={styles.subtitulo}>{subtitulo}</p>
      {chip && <span className={styles.chip}>{chip}</span>}
      {acciones && <div className={styles.cabeceraAcciones}>{acciones}</div>}
    </header>
  );
}
