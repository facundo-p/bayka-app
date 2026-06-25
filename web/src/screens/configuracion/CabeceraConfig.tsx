import styles from './SeccionesConfig.module.css';

interface CabeceraConfigProps {
  titulo: string;
  subtitulo: string;
  /** Chip a la derecha del título (ej. "8 habilitadas"). */
  chip?: string;
}

/** Cabecera común de las cards de Configuración: título serif + chip + subtítulo. */
export function CabeceraConfig({ titulo, subtitulo, chip }: CabeceraConfigProps) {
  return (
    <header className={styles.cabecera}>
      <div className={styles.cabeceraFila}>
        <h2 className={styles.titulo}>{titulo}</h2>
        {chip && <span className={styles.chip}>{chip}</span>}
      </div>
      <p className={styles.subtitulo}>{subtitulo}</p>
    </header>
  );
}
