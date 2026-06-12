import { Spinner } from './Spinner';
import styles from './Cargando.module.css';

/** Spinner centrado para el estado de carga de una pantalla o sección. */
export function Cargando() {
  return (
    <div className={styles.contenedor}>
      <Spinner />
    </div>
  );
}
