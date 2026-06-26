import { EspeciesConfigSection } from './EspeciesConfigSection';
import { GpsConfigSection } from './GpsConfigSection';
import { UsuariosConfigSection } from './UsuariosConfigSection';
import { VisibilidadConfigSection } from './VisibilidadConfigSection';
import styles from './ConfiguracionTab.module.css';

/**
 * Tab Configuración: especies (checklist) a la izquierda; GPS y técnicos
 * apilados a la derecha; visibilidad ocupando el ancho completo abajo.
 * Colapsa a una columna en angosto.
 */
export function ConfiguracionTab() {
  return (
    <div className={styles.grilla}>
      <div className={styles.columnaIzquierda}>
        <EspeciesConfigSection />
      </div>
      <div className={styles.columnaDerecha}>
        <GpsConfigSection />
        <UsuariosConfigSection />
      </div>
      <div className={styles.anchoCompleto}>
        <VisibilidadConfigSection />
      </div>
    </div>
  );
}
