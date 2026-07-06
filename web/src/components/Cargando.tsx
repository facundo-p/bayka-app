import { Spinner } from './Spinner';
import styles from './Cargando.module.css';

interface CargandoProps {
  /** Texto opcional bajo el spinner, ej. "Cargando árboles…". */
  label?: string;
}

/** Spinner centrado para el estado de carga de una pantalla o sección. */
export function Cargando({ label }: CargandoProps) {
  return (
    <div className={styles.contenedor}>
      <Spinner />
      {label && <p className={styles.label}>{label}</p>}
    </div>
  );
}
