import { Outlet } from 'react-router';
import styles from './SeccionesDatos.module.css';

/** Tab Datos del detalle de plantación: cada sección trae su propia toolbar. */
export function DatosTab() {
  return (
    <section className={styles.pantalla}>
      <Outlet />
    </section>
  );
}
