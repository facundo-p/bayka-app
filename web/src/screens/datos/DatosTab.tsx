import { Outlet } from 'react-router';
import styles from './SeccionesDatos.module.css';

/**
 * Tab Datos del detalle de plantación. Los sub-tabs Árboles / Grupos / Parcelas
 * y sus filtros viven ahora en la toolbar única de cada sección (DatosToolbar).
 */
export function DatosTab() {
  return (
    <section className={styles.pantalla}>
      <Outlet />
    </section>
  );
}
