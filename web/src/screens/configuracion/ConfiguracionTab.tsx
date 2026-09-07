import { ComportamientoConfigSection } from './ComportamientoConfigSection';
import { EspeciesConfigSection } from './EspeciesConfigSection';
import { UsuariosConfigSection } from './UsuariosConfigSection';
import styles from './ConfiguracionTab.module.css';

/**
 * Tab Configuración: el checklist de especies ocupa el alto completo a la
 * izquierda; comportamiento en la app y técnicos se apilan a la derecha.
 * Colapsa a una columna en angosto.
 */
export function ConfiguracionTab() {
  return (
    <div className={styles.grilla}>
      <EspeciesConfigSection />
      <div className={styles.columnaDerecha}>
        <ComportamientoConfigSection />
        <UsuariosConfigSection />
      </div>
    </div>
  );
}
